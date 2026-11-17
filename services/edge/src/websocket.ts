/**
 * WebSocket no modelo da Cloudflare: `new WebSocketPair()` devolve [cliente, servidor]; o Worker responde 101 com o
 * lado cliente e conversa pelo lado servidor. Aqui o lado servidor é ligado ao socket real (pacote `ws`) quando o
 * servidor HTTP faz o upgrade. Também cobre a API de hibernação dos Durable Objects (acceptWebSocket/webSocketMessage).
 */
import type { WebSocket as WsReal } from 'ws';

type Ouvinte = (ev: Record<string, unknown>) => void;

export interface DonoHibernado {
  webSocketMessage?(ws: CfWebSocket, msg: string | ArrayBuffer): unknown;
  webSocketClose?(ws: CfWebSocket, code: number, reason: string, wasClean: boolean): unknown;
  webSocketError?(ws: CfWebSocket, err: unknown): unknown;
}

/** Ligação compartilhada pelo par: o socket real e o que foi enviado antes dele existir. */
class Ligacao {
  real: WsReal | null = null;
  saida: (string | ArrayBuffer | Uint8Array)[] = [];
  fechar: { code?: number; reason?: string } | null = null;
}

export class CfWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = 1;
  /** só no lado servidor: quem trata as mensagens no modo hibernação */
  dono: DonoHibernado | null = null;
  tags: string[] = [];
  private aceito = false;
  private anexo: unknown = null;
  private ouvintes = new Map<string, Set<Ouvinte>>();
  private entrada: Record<string, unknown>[] = [];

  constructor(readonly ligacao: Ligacao, readonly lado: 'cliente' | 'servidor') {}

  accept(): void {
    this.aceito = true;
    const fila = this.entrada.splice(0);
    for (const ev of fila) this.emite(ev);
  }

  send(dados: string | ArrayBuffer | ArrayBufferView): void {
    if (this.readyState >= 2) throw new Error('WebSocket já fechado');
    const d = typeof dados === 'string' || dados instanceof ArrayBuffer ? dados : new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength);
    if (this.ligacao.real && this.ligacao.real.readyState === 1) this.ligacao.real.send(d);
    else this.ligacao.saida.push(d);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    if (this.ligacao.real) this.ligacao.real.close(code ?? 1000, reason);
    else this.ligacao.fechar = { code, reason };
  }

  addEventListener(tipo: string, fn: Ouvinte): void {
    if (!this.ouvintes.has(tipo)) this.ouvintes.set(tipo, new Set());
    this.ouvintes.get(tipo)!.add(fn);
  }
  removeEventListener(tipo: string, fn: Ouvinte): void {
    this.ouvintes.get(tipo)?.delete(fn);
  }

  serializeAttachment(v: unknown): void { this.anexo = structuredClone(v); }
  deserializeAttachment(): unknown { return this.anexo === null ? null : structuredClone(this.anexo); }

  /** Evento vindo do socket real para o lado servidor. */
  recebe(ev: Record<string, unknown> & { type: string }): void {
    if (ev.type === 'close') this.readyState = 3;
    if (this.dono) {
      const d = this.dono;
      const tratar = async () => {
        if (ev.type === 'message') await d.webSocketMessage?.(this, ev.data as string | ArrayBuffer);
        else if (ev.type === 'close') await d.webSocketClose?.(this, ev.code as number, ev.reason as string, ev.wasClean as boolean);
        else if (ev.type === 'error') await d.webSocketError?.(this, ev.error);
      };
      tratar().catch((e) => console.error('[edge] webSocket handler', (e as Error).message));
      return;
    }
    if (!this.aceito) { this.entrada.push(ev); return; }
    this.emite(ev);
  }

  private emite(ev: Record<string, unknown> & { type?: unknown }): void {
    for (const fn of this.ouvintes.get(String(ev.type)) ?? []) {
      try { fn(ev); } catch (e) { console.error('[edge] ouvinte de WebSocket', (e as Error).message); }
    }
  }
}

export class WebSocketPair {
  0: CfWebSocket;
  1: CfWebSocket;
  constructor() {
    const l = new Ligacao();
    this[0] = new CfWebSocket(l, 'cliente');
    this[1] = new CfWebSocket(l, 'servidor');
    (this[0] as unknown as { par: CfWebSocket }).par = this[1];
  }
  [Symbol.iterator](): Iterator<CfWebSocket> {
    return [this[0], this[1]][Symbol.iterator]();
  }
}

/** Liga o lado cliente devolvido na resposta 101 ao socket real aberto pelo servidor HTTP. */
export function ligar(cliente: CfWebSocket, real: WsReal): void {
  const servidor = (cliente as unknown as { par: CfWebSocket }).par;
  const l = cliente.ligacao;
  l.real = real;
  for (const d of l.saida.splice(0)) real.send(d);
  if (l.fechar) real.close(l.fechar.code ?? 1000, l.fechar.reason);
  real.on('message', (data, binario) => {
    const msg = binario
      ? (() => { const b = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); })()
      : data.toString();
    servidor.recebe({ type: 'message', data: msg });
  });
  real.on('close', (code, reason) => servidor.recebe({ type: 'close', code, reason: reason.toString(), wasClean: true }));
  real.on('error', (error) => servidor.recebe({ type: 'error', error, message: (error as Error).message }));
}

/**
 * O Response do Node recusa status 101. Este substituto aceita `{ status: 101, webSocket }` como na Cloudflare.
 * Vai para o globalThis antes de carregar os Workers.
 */
export class EdgeResponse extends Response {
  /** tipado como o WebSocket da Cloudflare (base Response); por dentro é sempre um CfWebSocket */
  readonly webSocket: WebSocket | null;
  private readonly status101: boolean;
  constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: CfWebSocket | WebSocket | null }) {
    const s101 = init?.status === 101;
    super(s101 ? null : body, s101 ? { ...init, status: 200 } : init);
    this.webSocket = (init?.webSocket ?? null) as WebSocket | null;
    this.status101 = s101;
  }
  override get status(): number {
    return this.status101 ? 101 : super.status;
  }
}
