import net from 'node:net';
import { EventEmitter } from 'node:events';
import { LineSplitter, parseTrxLine, type TrxPassing, type TrxStatus } from './trx-parser';

export type DecoderStatus = {
  host: string;
  port: number;
  connected: boolean;
  connectedAt: number | null;
  lastDataAt: number | null;
  lastStatusAt: number | null;
  lastPassingAt: number | null;
  noise: number | null;
  lastError: string | null;
  reconnects: number;
};

/**
 * Conexao TCP com o decoder TranX. Ao conectar manda os mesmos 2 comandos que o LapTime
 * mandava (LapTime.Server StartMenu, protocolo TRX): `@RESET` e `SOH ?;;;11;` (reinicia o
 * cronometro do decoder). Sem isso o TranX so manda status (#) e nunca as passagens ($).
 * Reconecta sozinho; se ficar 20s sem receber nada (o TranX manda status a cada ~5s),
 * derruba e reconecta.
 */
export const TRX_INIT_COMMANDS = ['@RESET', '\u0001?;;;11;'];

export class DecoderClient extends EventEmitter {
  readonly status: DecoderStatus;
  private socket: net.Socket | null = null;
  private splitter = new LineSplitter();
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdog: NodeJS.Timeout | null = null;

  constructor(host: string, port: number, private readonly silenceTimeoutMs = 20_000, private readonly initCommands: string[] = TRX_INIT_COMMANDS) {
    super();
    this.status = {
      host,
      port,
      connected: false,
      connectedAt: null,
      lastDataAt: null,
      lastStatusAt: null,
      lastPassingAt: null,
      noise: null,
      lastError: null,
      reconnects: 0,
    };
  }

  start() {
    this.stopped = false;
    this.connect();
    this.watchdog = setInterval(() => {
      const s = this.status;
      if (s.connected && s.lastDataAt && Date.now() - s.lastDataAt > this.silenceTimeoutMs) {
        s.lastError = `Sem dados do decoder ha ${Math.round((Date.now() - s.lastDataAt) / 1000)}s, reconectando`;
        this.socket?.destroy();
      }
    }, 5_000);
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.watchdog) clearInterval(this.watchdog);
    this.socket?.destroy();
  }

  private connect() {
    const s = this.status;
    this.splitter = new LineSplitter();
    const socket = net.createConnection({ host: s.host, port: s.port });
    this.socket = socket;
    socket.setEncoding('latin1');
    socket.setKeepAlive(true, 5_000);
    socket.setTimeout(8_000, () => {
      if (!s.connected) socket.destroy(new Error('Tempo esgotado conectando no decoder'));
    });

    socket.on('connect', () => {
      s.connected = true;
      s.connectedAt = Date.now();
      s.lastDataAt = Date.now();
      s.lastError = null;
      socket.setTimeout(0);
      // cada comando como o LapTime: texto + CRLF
      for (const cmd of this.initCommands) socket.write(cmd + '\r\n', 'latin1');
      if (this.initCommands.length) this.emit('init', this.initCommands);
      this.emit('change');
    });

    socket.on('data', (chunk: string) => {
      s.lastDataAt = Date.now();
      for (const line of this.splitter.push(chunk)) {
        const rec = parseTrxLine(line);
        if (rec.kind === 'passing') {
          s.lastPassingAt = Date.now();
          this.emit('passing', rec satisfies TrxPassing);
        } else if (rec.kind === 'status') {
          s.lastStatusAt = Date.now();
          s.noise = (rec satisfies TrxStatus).noise;
          this.emit('status', rec);
        } else {
          this.emit('other', rec.raw);
        }
      }
    });

    socket.on('error', (err) => {
      s.lastError = err.message;
    });

    socket.on('close', () => {
      const was = s.connected;
      s.connected = false;
      if (was) this.emit('change');
      if (this.stopped) return;
      s.reconnects += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), 2_000);
    });
  }
}
