import net from 'node:net';
import { EventEmitter } from 'node:events';
import { LineSplitter, parseTrxLine, type TrxPassing, type TrxStatus } from './trx-parser';
import { P3FrameSplitter, parseP3Frame } from './p3-parser';

/** 'p3' = porta 5403 binária (a do Orbits, relógio absoluto); 'trx' = porta 5100 texto (a do LapTime). */
export type DecoderProtocol = 'p3' | 'trx';

export type DecoderStatus = {
  host: string;
  port: number;
  protocol: DecoderProtocol;
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
  private p3 = new P3FrameSplitter();
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdog: NodeJS.Timeout | null = null;

  private readonly initCommands: string[];

  constructor(host: string, port: number, private readonly silenceTimeoutMs = 20_000, readonly protocol: DecoderProtocol = 'trx', initCommands?: string[]) {
    super();
    // no P3 não se manda comando nenhum: o decoder já entrega as passagens (é assim que o Orbits funciona)
    this.initCommands = initCommands ?? (protocol === 'trx' ? TRX_INIT_COMMANDS : []);
    this.status = {
      host,
      port,
      protocol,
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
    this.p3 = new P3FrameSplitter();
    const socket = net.createConnection({ host: s.host, port: s.port });
    this.socket = socket;
    if (this.protocol === 'trx') socket.setEncoding('latin1');
    socket.setKeepAlive(true, 5_000);
    socket.setTimeout(8_000, () => {
      if (!s.connected) socket.destroy(new Error('Tempo esgotado conectando no decoder'));
    });

    socket.on('connect', () => {
      s.connected = true;
      s.connectedAt = Date.now();
      s.lastDataAt = Date.now();
      s.lastError = null;
      // Item 2: Reseta reconexões após conexão estabelecida com sucesso
      setTimeout(() => { if (s.connected) s.reconnects = 0; }, 10_000).unref();
      // Item 4: Mantém timeout ativo de silêncio para detectar conexões half-open
      socket.setTimeout(this.silenceTimeoutMs);
      // cada comando como o LapTime: texto + CRLF
      for (const cmd of this.initCommands) socket.write(cmd + '\r\n', 'latin1');
      if (this.initCommands.length) this.emit('init', this.initCommands);
      this.emit('change');
    });

    socket.on('timeout', () => {
      if (s.connected) {
        s.lastError = `Timeout do socket TCP do decoder (${Math.round(this.silenceTimeoutMs / 1000)}s sem resposta)`;
        socket.destroy();
      }
    });

    socket.on('data', (chunk: string | Buffer) => {
      s.lastDataAt = Date.now();
      // Item 3: Proteção contra exceções no parsing de dados corrompidos
      try {
        const recs = this.protocol === 'p3'
          ? this.p3.push(chunk as Buffer).map(parseP3Frame)
          : this.splitter.push(chunk as string).map(parseTrxLine);
        for (const rec of recs) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        s.lastError = `Erro ao processar pacote do decoder: ${err?.message || err}`;
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
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
      // Item 2: Backoff exponencial para proteger o hardware do TranX (2s até no máximo 15s)
      const esperaMs = Math.min(15_000, Math.round(2_000 * Math.pow(1.4, Math.min(s.reconnects - 1, 6))));
      this.reconnectTimer = setTimeout(() => this.connect(), esperaMs);
    });
  }
}
