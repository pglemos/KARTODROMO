/** Senhas (scrypt) e token de sessao assinado (HMAC) do app da recepcao. */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function confereSenha(senha: string, armazenado: string): boolean {
  const [alg, saltB64, hashB64] = armazenado.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const obtido = scryptSync(senha, Buffer.from(saltB64, 'base64'), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

export type Sessao = { uid: number; nome: string; admin: boolean; exp: number };

/**
 * Segredo que assina a sessão da Recepção. O certo é OPS_SESSION_SECRET, só para isso.
 * OPS_RECEPCAO_KEY ainda é aceito para o servidor não parar na troca, mas é a chave que os workers e a
 * cronometragem também conhecem: quem a tiver consegue fabricar uma sessão de administrador.
 * Sem nenhum dos dois não há sessão (antes de 13/11/2026 caía num texto fixo, público no código).
 */
function segredo(): string {
  const valor = process.env.OPS_SESSION_SECRET || process.env.OPS_RECEPCAO_KEY;
  if (!valor) throw new Error('OPS_SESSION_SECRET não configurado: o servidor não pode emitir nem validar sessões.');
  return valor;
}

/** Diz como a sessão está sendo assinada, para o servidor avisar (ou recusar subir) na partida. */
export function situacaoSegredoSessao(): 'proprio' | 'compartilhado' | 'ausente' {
  if (process.env.OPS_SESSION_SECRET) return 'proprio';
  return process.env.OPS_RECEPCAO_KEY ? 'compartilhado' : 'ausente';
}

export function emiteToken(s: Omit<Sessao, 'exp'>, horas = 16): string {
  const payload = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + horas * 3_600_000 })).toString('base64url');
  const sig = createHmac('sha256', segredo()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Login novo para quem está usando: a Recepção fica aberta dias seguidos e o token de 16 h vencia no meio do
 * expediente (o agente de termos do totem parou 1h40 em 30/09). Renova quando faltam menos de 12 h.
 */
export function renovaToken(s: Sessao): string | null {
  if (s.exp - Date.now() > 12 * 3_600_000) return null;
  return emiteToken({ uid: s.uid, nome: s.nome, admin: s.admin });
}

export function validaToken(token: string | null | undefined): Sessao | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (situacaoSegredoSessao() === 'ausente') return null;
  const esperado = createHmac('sha256', segredo()).update(payload).digest('base64url');
  if (esperado.length !== sig.length || !timingSafeEqual(Buffer.from(esperado), Buffer.from(sig))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Sessao;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function senhaAleatoria(): string {
  // sem caracteres ambiguos (0/O, 1/l) pra ditar no balcao
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(8), (b) => abc[b % abc.length]).join('');
}
