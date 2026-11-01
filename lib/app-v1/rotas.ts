import type http from 'node:http';
import { writeTimingEvent } from '../timing/sse';
import { autenticar, bloquearUsuario, criarUsuario, login, LoginRecusado, pode, renovar, sair, type AuthCtx, type Identidade, type Perfil } from './auth';
import { consultarOperacao, ErroApp } from './comandos';
import type { AppStore } from './store';

const PREFIXO = '/api/app/v1/';
const MAX_CORPO = 64 * 1024;
const TAMANHO_MINIMO_SEGREDO = 32;
const CAPACIDADES_CONHECIDAS = ['sessoes.ver', 'elegiveis.ver', 'operacoes.ver', 'auditoria.ver', 'auditoria.global', 'usuarios.gerir',
  'bateria.preparar', 'sorteio.gravar', 'atrasado.incluir', 'peso.conferir', 'kart.trocar', 'frota.gerir', 'penalidade.aplicar', 'bandeira.aplicar',
  'prova.comandar', 'prova.reiniciar', 'passagem.corrigir', 'equalizacao.gerir'];

export type DepsApp = {
  store: AppStore;
  segredo: string;
  listarSessoes: () => unknown[];
  verSessao: (id: string) => unknown;
  assinarMudancas: (cb: () => void) => () => void;
  batidaMs?: number;
  limiteLoginPorMinuto?: number;
  limitePor10s?: number;
  routeMode?: string;
};
export type ModuloApp = { tratar(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean>; aoSalvarSessao(id: string): void };

type Bucket = { n: number; ate: number };
function limitador(limite: number, janelaMs: number) {
  const b = new Map<string, Bucket>();
  return (chave: string) => {
    const agora = Date.now();
    if (b.size > 5000) for (const [k, v] of b) if (v.ate <= agora) b.delete(k);
    const a = b.get(chave);
    if (!a || a.ate <= agora) { b.set(chave, { n: 1, ate: agora + janelaMs }); return true; }
    return ++a.n <= limite;
  };
}

const enviar = (res: http.ServerResponse, status: number, corpo: unknown, extra: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(corpo));
};
const erro = (res: http.ServerResponse, status: number, codigo: string, mensagem: string, extra?: Record<string, string>) => enviar(res, status, { codigo, erro: mensagem }, extra);

async function lerCorpo(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const p of req) {
    total += (p as Buffer).length;
    if (total > MAX_CORPO) throw new ErroApp(400, 'INVALID_REQUEST', 'Pedido grande demais.');
    partes.push(p as Buffer);
  }
  try {
    const v = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* cai no erro abaixo */ }
  throw new ErroApp(400, 'INVALID_REQUEST', 'Corpo inválido.');
}

/** Só o que a operação precisa ver: e-mail, CPF, peso e cadastro não saem por esta API. */
function visaoSessao(store: AppStore, s: unknown) {
  const v = s as { id: string; name?: string; type?: string; state?: string; createdAt?: number; startedAt?: number | null; agendaId?: number | null; competitors?: { kart?: string; name?: string; autoAdded?: boolean }[] };
  return {
    id: v.id, name: v.name, type: v.type, state: v.state, createdAt: v.createdAt, startedAt: v.startedAt ?? null, agendaId: v.agendaId ?? null,
    competitors: (v.competitors ?? []).map((c) => ({ kart: c.kart, name: c.name, autoAdded: Boolean(c.autoAdded) })),
    sessionRevision: store.revisao(v.id),
  };
}

const ipDe = (req: http.IncomingMessage) => String(req.headers['cf-connecting-ip'] ?? req.socket?.remoteAddress ?? '?');

export function criarModuloApp(d: DepsApp): ModuloApp {
  const ctx: AuthCtx = { store: d.store, segredo: d.segredo };
  const limiteLogin = limitador(d.limiteLoginPorMinuto ?? 10, 60_000);
  const limiteGeral = limitador(d.limitePor10s ?? 200, 10_000);
  const clientesAtivos = new Set<() => void>();
  let indisponivel = d.segredo.length < TAMANHO_MINIMO_SEGREDO;

  function eventos(res: http.ServerResponse, req: http.IncomingMessage, header: string | undefined) {
    let seq = 0;
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    const mandarEstado = () => {
      seq += 1;
      writeTimingEvent(res, `event: state\ndata: ${JSON.stringify({ seq, sessoes: d.listarSessoes().map((s) => visaoSessao(d.store, s)) })}\n\n`);
    };
    const parar = () => { clearInterval(batida); cancelar(); clientesAtivos.delete(encerrar); };
    const encerrar = () => { writeTimingEvent(res, 'event: auth-expired\ndata: {}\n\n'); parar(); res.end(); };
    const conferir = () => { if (indisponivel || !autenticar(ctx, header)) { encerrar(); return false; } return true; };
    const cancelar = d.assinarMudancas(() => { if (conferir()) mandarEstado(); });
    const batida = setInterval(() => { if (conferir()) writeTimingEvent(res, ': batida\n\n'); }, d.batidaMs ?? 15_000);
    clientesAtivos.add(encerrar);
    req.on('close', parar);
    mandarEstado();
  }

  async function rotear(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const metodo = req.method ?? 'GET';
    const caminho = url.pathname.slice(PREFIXO.length).replace(/\/+$/, '');
    const header = req.headers.authorization;

    if (caminho === 'auth/login' && metodo === 'POST') {
      if (!limiteLogin(ipDe(req))) return erro(res, 429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco.', { 'retry-after': '60' });
      const b = await lerCorpo(req);
      const t = await login(ctx, String(b.usuario ?? ''), String(b.senha ?? ''), String(b.deviceId ?? ''));
      return enviar(res, 200, t);
    }
    if (caminho === 'auth/refresh' && metodo === 'POST') {
      const b = await lerCorpo(req);
      return enviar(res, 200, renovar(ctx, String(b.refreshToken ?? '')));
    }

    const quem: Identidade | null = autenticar(ctx, header);
    if (!quem) return erro(res, 401, 'UNAUTHENTICATED', 'Entre novamente.');
    const exige = (cap: string) => { if (!pode(quem.perfil, cap)) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão para esta ação.'); };

    if (caminho === 'auth/logout' && metodo === 'POST') { sair(ctx, quem.sessaoId); return enviar(res, 200, { ok: true }); }
    if (caminho === 'me' && metodo === 'GET') {
      return enviar(res, 200, { usuario: quem.usuario, nome: quem.nome, perfil: quem.perfil, expiraEm: quem.expiraEm, capacidades: CAPACIDADES_CONHECIDAS.filter((c) => pode(quem.perfil, c)) });
    }
    if (caminho === 'events' && metodo === 'GET') { exige('sessoes.ver'); return eventos(res, req, header); }
    if (caminho === 'sessions' && metodo === 'GET') { exige('sessoes.ver'); return enviar(res, 200, { sessoes: d.listarSessoes().map((s) => visaoSessao(d.store, s)) }); }
    let m = /^sessions\/([\w-]+)$/.exec(caminho);
    if (m && metodo === 'GET') {
      exige('sessoes.ver');
      const s = d.verSessao(m[1]);
      return s ? enviar(res, 200, visaoSessao(d.store, s)) : erro(res, 404, 'NOT_FOUND', 'Bateria não encontrada.');
    }
    m = /^operations\/([\w-]+)$/.exec(caminho);
    if (m && metodo === 'GET') {
      exige('operacoes.ver');
      const o = consultarOperacao(d.store, m[1], quem);
      return o ? enviar(res, 200, o) : erro(res, 404, 'NOT_FOUND', 'Operação não encontrada.');
    }
    if (caminho === 'audit' && metodo === 'GET') {
      exige('auditoria.ver');
      const global = pode(quem.perfil, 'auditoria.global');
      const linhas = global
        ? d.store.db.prepare('SELECT * FROM auditoria ORDER BY timestampServerUTC DESC LIMIT 200').all()
        : d.store.db.prepare('SELECT * FROM auditoria WHERE actorUserId = ? ORDER BY timestampServerUTC DESC LIMIT 200').all(quem.usuarioId);
      return enviar(res, 200, { auditoria: linhas });
    }
    if (caminho === 'users' && metodo === 'GET') {
      exige('usuarios.gerir');
      return enviar(res, 200, { usuarios: d.store.db.prepare('SELECT usuario, nome, perfil, bloqueado, criadoEm FROM usuarios ORDER BY usuario').all() });
    }
    if (caminho === 'users' && metodo === 'POST') {
      exige('usuarios.gerir');
      const b = await lerCorpo(req);
      try {
        await criarUsuario(ctx, { usuario: String(b.usuario ?? ''), nome: String(b.nome ?? ''), perfil: String(b.perfil ?? '') as Perfil, senha: String(b.senha ?? '') });
      } catch (e) { throw new ErroApp(400, 'INVALID_REQUEST', /UNIQUE/.test((e as Error).message) ? 'Esse usuário já existe.' : (e as Error).message); }
      return enviar(res, 201, { ok: true });
    }
    m = /^users\/([\w.-]+)\/block$/.exec(caminho);
    if (m && metodo === 'POST') {
      exige('usuarios.gerir');
      const b = await lerCorpo(req);
      try { bloquearUsuario(ctx, m[1], b.bloqueado !== false); } catch (e) { throw new ErroApp(404, 'NOT_FOUND', (e as Error).message); }
      return enviar(res, 200, { ok: true });
    }
    // Comandos de prova não existem na F1: nenhum perfil chega neles.
    return erro(res, 404, 'NOT_FOUND', 'Rota desconhecida.');
  }

  return {
    async tratar(req, res, url) {
      if (!url.pathname.startsWith(PREFIXO)) return false;
      if (indisponivel) { erro(res, 503, 'UNAVAILABLE', 'App operacional indisponível.'); return true; }
      if (!limiteGeral(ipDe(req))) { erro(res, 429, 'RATE_LIMITED', 'Muitas requisições. Aguarde.', { 'retry-after': '10' }); return true; }
      try {
        await rotear(req, res, url);
      } catch (e) {
        if (res.headersSent) { res.end(); return true; }
        if (e instanceof LoginRecusado) erro(res, 401, 'UNAUTHENTICATED', e.message);
        else if (e instanceof ErroApp) enviar(res, e.http, { codigo: e.codigo, erro: e.message, ...e.extra });
        else erro(res, 500, 'SERVER_ERROR', 'Erro interno.');
      }
      return true;
    },
    aoSalvarSessao(id) {
      try {
        d.store.subirRevisao(id);
      } catch {
        // sem revisão confiável não se opera, mas a cronometragem nunca para por causa do app
        indisponivel = true;
        for (const fechar of [...clientesAtivos]) fechar();
      }
    },
  };
}
