import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { AppStore } from './store';

const scryptAsync = promisify(scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

export type Perfil = 'RECEPCAO' | 'OPERACAO' | 'GERENCIA';
export type Relogio = () => number;
export type AuthCtx = { store: AppStore; segredo: string; relogio?: Relogio };
export type Identidade = { usuarioId: string; usuario: string; nome: string; perfil: Perfil; sessaoId: string; deviceId: string; expiraEm: number };
export type Tokens = { accessToken: string; refreshToken: string; expiraEm: number };

export class LoginRecusado extends Error {
  constructor(public readonly motivo: string = 'Usuário ou senha inválidos.') { super(motivo); }
}

const ACESSO_MS = 15 * 60_000;
const SESSAO_MS = 12 * 3_600_000;
const FALHAS_ATE_ATRASAR = 5;
const ATRASO_MS = 30_000;
const TAMANHO_HASH = 64;

const LEITURA = ['sessoes.ver', 'elegiveis.ver', 'operacoes.ver', 'auditoria.ver'];
const OPERACAO = [
  ...LEITURA, 'bateria.preparar', 'sorteio.gravar', 'atrasado.incluir', 'peso.conferir', 'kart.trocar', 'frota.gerir', 'penalidade.aplicar',
  'bandeira.aplicar', 'prova.comandar', 'prova.reiniciar', 'passagem.corrigir', 'equalizacao.gerir',
];
const CAPACIDADES: Record<Perfil, ReadonlySet<string>> = {
  RECEPCAO: new Set(LEITURA),
  OPERACAO: new Set(OPERACAO),
  GERENCIA: new Set([...OPERACAO, 'usuarios.gerir', 'auditoria.global']),
};

export function pode(perfil: Perfil, capacidade: string): boolean {
  return CAPACIDADES[perfil]?.has(capacidade) ?? false;
}

const agoraDe = (ctx: AuthCtx) => (ctx.relogio ?? Date.now)();
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const b64 = (v: string) => Buffer.from(v).toString('base64url');

async function gerarHash(senha: string) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${(await scryptAsync(senha, sal, TAMANHO_HASH)).toString('hex')}`;
}
const HASH_FALSO = `scrypt$${'00'.repeat(16)}$${'00'.repeat(TAMANHO_HASH)}`;

async function senhaConfere(senha: string, guardado: string) {
  const [, sal, hash] = guardado.split('$');
  const esperado = Buffer.from(hash, 'hex');
  const obtido = await scryptAsync(senha, Buffer.from(sal, 'hex'), TAMANHO_HASH);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

function assinar(segredo: string, corpo: string) {
  return createHmac('sha256', segredo).update(corpo).digest('base64url');
}

function emitir(ctx: AuthCtx, sessaoId: string, expiraAbsoluto: number): Tokens {
  const expiraEm = Math.min(agoraDe(ctx) + ACESSO_MS, expiraAbsoluto);
  const corpo = b64(JSON.stringify({ sid: sessaoId, exp: expiraEm }));
  const refreshToken = `${sessaoId}.${randomBytes(32).toString('base64url')}`;
  ctx.store.db.prepare('UPDATE sessoes SET refreshHash = ? WHERE id = ?').run(sha(refreshToken), sessaoId);
  return { accessToken: `${corpo}.${assinar(ctx.segredo, corpo)}`, refreshToken, expiraEm };
}

export async function criarUsuario(ctx: AuthCtx, u: { usuario: string; nome: string; perfil: Perfil; senha: string }) {
  if (u.senha.length < 10) throw new Error('A senha precisa de pelo menos 10 caracteres.');
  if (!(u.perfil in CAPACIDADES)) throw new Error('Perfil inválido.');
  const id = randomUUID();
  const senhaHash = await gerarHash(u.senha);
  ctx.store.db.prepare('INSERT INTO usuarios (id, usuario, nome, perfil, senhaHash, criadoEm) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, u.usuario.trim().toLowerCase(), u.nome.trim(), u.perfil, senhaHash, new Date(agoraDe(ctx)).toISOString());
  return id;
}

type LinhaUsuario = { id: string; usuario: string; nome: string; perfil: Perfil; senhaHash: string; bloqueado: number; falhas: number; bloqueadoAte: number };

export async function login(ctx: AuthCtx, usuario: string, senha: string, deviceId: string): Promise<Tokens> {
  const { db } = ctx.store;
  const nome = String(usuario ?? '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(nome) as LinhaUsuario | undefined;
  // usuário inexistente custa o mesmo tempo, para não revelar quem existe
  const certa = await senhaConfere(String(senha ?? ''), u?.senhaHash ?? HASH_FALSO);
  if (!u || u.bloqueado) throw new LoginRecusado();
  const agora = agoraDe(ctx);
  if (u.bloqueadoAte > agora) throw new LoginRecusado();
  if (!certa) {
    const falhas = u.falhas + 1;
    db.prepare('UPDATE usuarios SET falhas = ?, bloqueadoAte = ? WHERE id = ?')
      .run(falhas >= FALHAS_ATE_ATRASAR ? 0 : falhas, falhas >= FALHAS_ATE_ATRASAR ? agora + ATRASO_MS : 0, u.id);
    throw new LoginRecusado();
  }
  const sessaoId = randomUUID();
  const expiraAbsoluto = agora + SESSAO_MS;
  return ctx.store.transacao(() => {
    db.prepare('UPDATE usuarios SET falhas = 0, bloqueadoAte = 0 WHERE id = ?').run(u.id);
    db.prepare(`INSERT INTO sessoes (id, usuarioId, deviceId, refreshHash, expiraAbsolutoEm, criadoEm) VALUES (?, ?, ?, '', ?, ?)`)
      .run(sessaoId, u.id, String(deviceId ?? '').slice(0, 120), expiraAbsoluto, agora);
    return emitir(ctx, sessaoId, expiraAbsoluto);
  });
}

type LinhaSessao = { id: string; usuarioId: string; deviceId: string; refreshHash: string; expiraAbsolutoEm: number; revogadaEm: number | null };

export function renovar(ctx: AuthCtx, refreshToken: string): Tokens {
  const { db } = ctx.store;
  const token = String(refreshToken ?? '');
  const sessaoId = token.split('.')[0];
  const s = db.prepare('SELECT * FROM sessoes WHERE id = ?').get(sessaoId) as LinhaSessao | undefined;
  if (!s || s.revogadaEm) throw new LoginRecusado('Sessão encerrada.');
  const agora = agoraDe(ctx);
  if (s.refreshHash !== sha(token)) {
    // refresh antigo reapareceu: pode ter vazado, encerra a sessão inteira
    db.prepare('UPDATE sessoes SET revogadaEm = ? WHERE id = ?').run(agora, s.id);
    throw new LoginRecusado('Sessão encerrada.');
  }
  const u = db.prepare('SELECT bloqueado FROM usuarios WHERE id = ?').get(s.usuarioId) as { bloqueado: number } | undefined;
  if (!u || u.bloqueado || agora >= s.expiraAbsolutoEm) throw new LoginRecusado('Sessão encerrada.');
  return emitir(ctx, s.id, s.expiraAbsolutoEm);
}

export function sair(ctx: AuthCtx, sessaoId: string) {
  ctx.store.db.prepare('UPDATE sessoes SET revogadaEm = ? WHERE id = ? AND revogadaEm IS NULL').run(agoraDe(ctx), sessaoId);
}

/** Revalida sessão e usuário no banco a cada pedido: bloqueio vale já no seguinte. */
export function autenticar(ctx: AuthCtx, header: unknown): Identidade | null {
  const m = typeof header === 'string' ? /^Bearer\s+([\w-]+)\.([\w-]+)$/.exec(header) : null;
  if (!m) return null;
  const esperado = Buffer.from(assinar(ctx.segredo, m[1]));
  const recebido = Buffer.from(m[2]);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  let corpo: { sid?: unknown; exp?: unknown };
  try { corpo = JSON.parse(Buffer.from(m[1], 'base64url').toString()); } catch { return null; }
  const agora = agoraDe(ctx);
  if (typeof corpo.sid !== 'string' || typeof corpo.exp !== 'number' || corpo.exp <= agora) return null;
  const l = ctx.store.db.prepare(`SELECT s.id sessaoId, s.deviceId, s.expiraAbsolutoEm, s.revogadaEm, u.id usuarioId, u.usuario, u.nome, u.perfil, u.bloqueado
    FROM sessoes s JOIN usuarios u ON u.id = s.usuarioId WHERE s.id = ?`).get(corpo.sid) as
    (Omit<Identidade, 'expiraEm'> & { expiraAbsolutoEm: number; revogadaEm: number | null; bloqueado: number }) | undefined;
  if (!l || l.revogadaEm || l.bloqueado || agora >= l.expiraAbsolutoEm) return null;
  return { usuarioId: l.usuarioId, usuario: l.usuario, nome: l.nome, perfil: l.perfil, sessaoId: l.sessaoId, deviceId: l.deviceId, expiraEm: corpo.exp };
}

export function bloquearUsuario(ctx: AuthCtx, usuario: string, bloqueado: boolean) {
  const r = ctx.store.db.prepare('UPDATE usuarios SET bloqueado = ? WHERE usuario = ?').run(bloqueado ? 1 : 0, usuario.trim().toLowerCase());
  if (!r.changes) throw new Error('Usuário não encontrado.');
}
