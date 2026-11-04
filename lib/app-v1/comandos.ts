import { createHash, randomUUID } from 'node:crypto';
import { pode, type Identidade } from './auth';
import type { AppStore } from './store';

export type Pedido = { operationId: string; sessionId: string; expectedSessionRevision: number; command: string; payload: unknown; reason?: string };
export type Status = 'PENDING' | 'APPLIED' | 'REJECTED' | 'UNKNOWN';
export type Resposta = { operationId: string; status: Status; sessionId: string; sessionRevision: number; resultado?: unknown; erro?: string };
export type CtxComando = { store: AppStore; identidade: Identidade; routeMode: string; capacidade: string };

export class ErroApp extends Error {
  constructor(public readonly http: number, public readonly codigo: string, mensagem: string, public readonly extra?: Record<string, unknown>) { super(mensagem); }
}

const filas = new Map<string, Promise<unknown>>();

/** Comandos da mesma bateria nunca se intercalam, mesmo com await no meio. */
export function filaPorBateria<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(sessionId) ?? Promise.resolve();
  const atual = anterior.then(fn, fn);
  const cauda = atual.catch(() => undefined);
  filas.set(sessionId, cauda);
  void cauda.then(() => { if (filas.get(sessionId) === cauda) filas.delete(sessionId); });
  return atual;
}

function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
const hashPedido = (p: Pedido) => createHash('sha256').update(canonico({ s: p.sessionId, c: p.command, p: p.payload })).digest('hex');

type Linha = { operationId: string; actorUserId: string; sessionId: string; payloadHash: string; status: Status; resposta: string | null };
const ler = (store: AppStore, id: string) => store.db.prepare('SELECT * FROM operacoes WHERE operationId = ?').get(id) as Linha | undefined;

function resposta(store: AppStore, l: Linha): Resposta {
  const r = l.resposta ? JSON.parse(l.resposta) as Partial<Resposta> : {};
  return { ...r, operationId: l.operationId, status: l.status, sessionId: l.sessionId, sessionRevision: store.revisao(l.sessionId) };
}

export function consultarOperacao(store: AppStore, id: string, quem: Identidade): Resposta | null {
  const l = ler(store, id);
  if (!l || (l.actorUserId !== quem.usuarioId && quem.perfil !== 'GERENCIA')) return null;
  return resposta(store, l);
}

/** Chamar ao subir: o que estava em andamento quando o processo caiu não tem resultado conhecido. */
export function marcarPendentesComoDesconhecidas(store: AppStore) {
  store.db.prepare(`UPDATE operacoes SET status = 'UNKNOWN', atualizadoEm = ? WHERE status = 'PENDING'`).run(new Date().toISOString());
}

function finalizar(ctx: CtxComando, p: Pedido, hash: string, status: Status, corpo: { resultado?: unknown; erro?: string }) {
  const agora = new Date().toISOString();
  const { store, identidade: q } = ctx;
  store.transacao(() => {
    store.db.prepare('UPDATE operacoes SET status = ?, resposta = ?, atualizadoEm = ? WHERE operationId = ?').run(status, JSON.stringify(corpo), agora, p.operationId);
    store.db.prepare(`INSERT INTO auditoria (auditId, operationId, actorUserId, actorRole, deviceId, sessionId, timestampServerUTC, routeMode, action, reason, after, status, requestHash, sourceSystem, correlationId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'app-v1', ?)`)
      .run(randomUUID(), p.operationId, q.usuarioId, q.perfil, q.deviceId, p.sessionId, agora, ctx.routeMode, p.command, p.reason ?? null, JSON.stringify(corpo), status, hash, p.operationId);
  });
}

/**
 * Revisão e idempotência são conferidas dentro da fila da bateria. Erro comum do handler vira REJECTED;
 * erro com `desconhecido: true` (efeito pode ter ocorrido) vira UNKNOWN e nunca é repetido sozinho.
 */
export function executar(ctx: CtxComando, p: Pedido, handler: () => Promise<unknown>): Promise<Resposta> {
  if (!pode(ctx.identidade.perfil, ctx.capacidade)) return Promise.reject(new ErroApp(403, 'FORBIDDEN', 'Sem permissão para esta ação.'));
  return filaPorBateria(p.sessionId, async () => {
    const { store, identidade: q } = ctx;
    const hash = hashPedido(p);
    const existente = ler(store, p.operationId);
    if (existente) {
      if (existente.actorUserId !== q.usuarioId || existente.payloadHash !== hash) throw new ErroApp(409, 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'Este identificador já foi usado em outra operação.');
      return resposta(store, existente);
    }
    const revisao = store.revisao(p.sessionId);
    if (p.expectedSessionRevision !== revisao) throw new ErroApp(409, 'REVISION_CONFLICT', 'A bateria mudou. Confira os dados e confirme de novo.', { sessionRevision: revisao });
    store.db.prepare(`INSERT INTO operacoes (operationId, actorUserId, command, sessionId, payloadHash, status, criadoEm) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`)
      .run(p.operationId, q.usuarioId, p.command, p.sessionId, hash, new Date().toISOString());
    let status: Status = 'APPLIED';
    let corpo: { resultado?: unknown; erro?: string };
    try {
      corpo = { resultado: await handler() };
    } catch (err) {
      status = (err as { desconhecido?: boolean }).desconhecido ? 'UNKNOWN' : 'REJECTED';
      corpo = { erro: (err as Error).message };
    }
    finalizar(ctx, p, hash, status, corpo);
    return { ...corpo, operationId: p.operationId, status, sessionId: p.sessionId, sessionRevision: store.revisao(p.sessionId) };
  });
}
