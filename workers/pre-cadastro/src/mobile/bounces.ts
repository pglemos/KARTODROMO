/**
 * E-mails que voltaram (13/11/2026). O Resend chama /api/resend/webhook quando a caixa do destinatário recusa a
 * mensagem (endereço que não existe, caixa desativada). Guardamos o endereço para o painel da recepção avisar
 * "E-mail voltou" na ficha do piloto: o cliente acha que o sistema falhou, mas o e-mail cadastrado está errado.
 *
 * Assinatura: padrão Svix (cabeçalhos svix-id, svix-timestamp, svix-signature) com o segredo RESEND_WEBHOOK_SECRET
 * ("whsec_" + base64). Sem segredo configurado, o webhook recusa tudo.
 */
export interface BouncesEnv {
  MOBILE_DB?: D1Database;
  RESEND_WEBHOOK_SECRET?: string;
}

export type EmailQueVoltou = { email: string; motivo: string; assunto: string; em: number };

const JANELA_ASSINATURA_MS = 5 * 60_000;
const GUARDA_DIAS = 180;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

function base64ParaBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function iguaisEmTempoConstante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Confere a assinatura Svix do Resend. Exportada para o teste. */
export async function assinaturaValida(segredo: string, id: string, timestamp: string, assinaturas: string, corpo: string, agora = Date.now()) {
  if (!segredo || !id || !timestamp || !assinaturas) return false;
  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(agora - ts) > JANELA_ASSINATURA_MS) return false;
  const chave = await crypto.subtle.importKey('raw', base64ParaBytes(segredo.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${id}.${timestamp}.${corpo}`)));
  const esperado = btoa(String.fromCharCode(...mac));
  return assinaturas.split(' ').some((parte) => {
    const [versao, valor] = parte.split(',');
    return versao === 'v1' && typeof valor === 'string' && iguaisEmTempoConstante(valor, esperado);
  });
}

/** "Nome <x@y.com>" ou "x@y.com" -> "x@y.com" em minúsculas. */
export function soEndereco(destino: string) {
  const m = /<([^>]+)>/.exec(destino);
  return (m ? m[1] : destino).trim().toLowerCase();
}

async function garantirTabela(db: D1Database) {
  await db.prepare('CREATE TABLE IF NOT EXISTS email_bounces (email TEXT PRIMARY KEY, motivo TEXT NOT NULL, assunto TEXT NOT NULL, em INTEGER NOT NULL)').run();
}

export async function handleResendWebhook(request: Request, env: BouncesEnv) {
  if (request.method !== 'POST') return json(405, { erro: 'Método não permitido.' });
  if (!env.MOBILE_DB || !env.RESEND_WEBHOOK_SECRET) return json(503, { erro: 'Webhook não configurado.' });
  const corpo = await request.text();
  const ok = await assinaturaValida(env.RESEND_WEBHOOK_SECRET, request.headers.get('svix-id') ?? '', request.headers.get('svix-timestamp') ?? '',
    request.headers.get('svix-signature') ?? '', corpo);
  if (!ok) return json(401, { erro: 'Assinatura inválida.' });
  let evento: { type?: string; created_at?: string; data?: { to?: string[] | string; subject?: string; bounce?: { type?: string; subType?: string; message?: string } } };
  try { evento = JSON.parse(corpo); } catch { return json(400, { erro: 'JSON inválido.' }); }
  // só recusa definitiva: caixa cheia/fora do ar (Transient) costuma resolver sozinha
  if (evento.type !== 'email.bounced' || (evento.data?.bounce?.type && evento.data.bounce.type !== 'Permanent')) return json(200, { ok: true, ignorado: true });
  const destinos = Array.isArray(evento.data?.to) ? evento.data!.to : evento.data?.to ? [evento.data.to] : [];
  const motivo = String(evento.data?.bounce?.message || evento.data?.bounce?.subType || 'A caixa de e-mail recusou a mensagem').slice(0, 300);
  const assunto = String(evento.data?.subject ?? '').slice(0, 200);
  const em = Date.parse(String(evento.created_at ?? '')) || Date.now();
  await garantirTabela(env.MOBILE_DB);
  for (const d of destinos) {
    const email = soEndereco(String(d));
    if (!email.includes('@')) continue;
    await env.MOBILE_DB.prepare(
      `INSERT INTO email_bounces(email, motivo, assunto, em) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET motivo = excluded.motivo, assunto = excluded.assunto, em = excluded.em`,
    ).bind(email, motivo, assunto, em).run();
  }
  return json(200, { ok: true, gravados: destinos.length });
}

/** Endereços que voltaram nos últimos 180 dias, por e-mail em minúsculas. */
export async function emailsQueVoltaram(db: D1Database, agora = Date.now()): Promise<Record<string, Omit<EmailQueVoltou, 'email'>>> {
  await garantirTabela(db);
  const { results } = await db.prepare('SELECT email, motivo, assunto, em FROM email_bounces WHERE em > ?')
    .bind(agora - GUARDA_DIAS * 86_400_000).all<EmailQueVoltou>();
  return Object.fromEntries(results.map((r) => [r.email, { motivo: r.motivo, assunto: r.assunto, em: r.em }]));
}
