/**
 * Perfil do piloto no app (dados do cadastro do kartódromo). O cadastro vive no SRVKART: ele publica aqui o perfil
 * de quem tem conta ligada e busca as alterações que o piloto pediu pelo app, grava no cadastro e publica de novo.
 *
 *   GET  /api/mobile/v1/conta/perfil           (sessão)  → { perfil, pendente }
 *   PUT  /api/mobile/v1/conta/perfil           (sessão)  { campos editáveis } → fica pendente até o SRVKART gravar
 *   GET  /api/mobile/v1/internal/perfil         (x-mobile-admin-token) → clientes com pedido ou sem perfil publicado
 *   POST /api/mobile/v1/internal/perfil         (x-mobile-admin-token) { itens: [{ cliente, perfil, aplicado?, erro? }] }
 *
 * Nome, CPF e e-mail não se mudam pelo app (são a identidade da conta): a recepção altera.
 */
import { authenticateMobileRequest, type MobileAuthEnv } from './auth';

export interface MobilePerfilEnv extends MobileAuthEnv {
  MOBILE_DB?: D1Database;
  MOBILE_ADMIN_TOKEN?: string;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function igual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const TEXTO: Record<string, number> = { telefone: 20, sexo: 1, tipoSanguineo: 3, cep: 12, endereco: 120, numero: 20, complemento: 60, bairro: 60, cidade: 60, estado: 2 };
const SANGUE = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

function dataIsoValida(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [ano, mes, dia] = value.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const hoje = new Date();
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
    && value >= '1920-01-01' && value <= hoje.toISOString().slice(0, 10);
}

/** Só os campos editáveis, limpos e validados; erro em texto para o piloto. */
export function validarPerfil(c: Record<string, unknown>): { ok: true; dados: Record<string, string | number | null> } | { ok: false; erro: string } {
  const dados: Record<string, string | number | null> = {};
  for (const [k, max] of Object.entries(TEXTO)) {
    if (!(k in c)) continue;
    const v = c[k] === null ? '' : String(c[k] ?? '').replace(/\s+/g, ' ').trim();
    dados[k] = v ? v.slice(0, max) : null;
  }
  if (dados.telefone) { const t = String(dados.telefone).replace(/\D/g, ''); if (t.length < 10 || t.length > 11) return { ok: false, erro: 'Telefone com DDD: 10 ou 11 números.' }; dados.telefone = t; }
  if (dados.cep) { const t = String(dados.cep).replace(/\D/g, ''); if (t.length !== 8) return { ok: false, erro: 'CEP com 8 números.' }; dados.cep = t; }
  if (dados.estado) { dados.estado = String(dados.estado).toUpperCase(); if (!/^[A-Z]{2}$/.test(dados.estado)) return { ok: false, erro: 'Estado com 2 letras (ex.: MG).' }; }
  if (dados.sexo && !['M', 'F'].includes(String(dados.sexo))) return { ok: false, erro: 'Gênero inválido.' };
  if (dados.tipoSanguineo && !SANGUE.has(String(dados.tipoSanguineo))) return { ok: false, erro: 'Tipo sanguíneo inválido.' };
  if ('nascimento' in c) {
    const n = String(c.nascimento ?? '').trim();
    if (n && !dataIsoValida(n)) return { ok: false, erro: 'Data de nascimento inválida.' };
    dados.nascimento = n || null;
  }
  if ('peso' in c) {
    const p = c.peso === null || c.peso === '' ? null : Number(String(c.peso).replace(',', '.'));
    if (p !== null && (!Number.isFinite(p) || p < 15 || p > 250)) return { ok: false, erro: 'Peso entre 15 e 250 kg.' };
    dados.peso = p === null ? null : Math.round(p * 10) / 10;
  }
  if (!Object.keys(dados).length) return { ok: false, erro: 'Nada para alterar.' };
  return { ok: true, dados };
}

async function tabela(env: MobilePerfilEnv) {
  await env.MOBILE_DB!.prepare(`CREATE TABLE IF NOT EXISTS mobile_perfil (cliente TEXT PRIMARY KEY, perfil TEXT, publicado_em INTEGER,
    pedido TEXT, pedido_em INTEGER, erro TEXT)`).run();
}

export async function handleMobilePerfil(request: Request, env: MobilePerfilEnv) {
  if (!env.MOBILE_DB || !env.MOBILE_ADMIN_TOKEN) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const p = new URL(request.url).pathname;
  try {
    await tabela(env);
    if (p === '/api/mobile/v1/internal/perfil') {
      if (!igual(request.headers.get('x-mobile-admin-token') ?? '', env.MOBILE_ADMIN_TOKEN)) return json(401, { erro: 'Não autorizado.' });
      if (request.method === 'GET') {
        // pedidos pendentes primeiro; depois quem tem conta ligada e perfil velho (mais de 1 dia) ou nunca publicado
        const r = await env.MOBILE_DB.prepare(
          `SELECT l.customer_id cliente, p.pedido pedido FROM mobile_identity_links l LEFT JOIN mobile_perfil p ON p.cliente = l.customer_id
            WHERE p.pedido IS NOT NULL OR p.publicado_em IS NULL OR p.publicado_em < ?
            ORDER BY (p.pedido IS NULL), p.pedido_em LIMIT 50`,
        ).bind(Date.now() - 86_400_000).all<{ cliente: string; pedido: string | null }>();
        return json(200, { itens: (r.results ?? []).map((x) => ({ cliente: x.cliente, pedido: x.pedido ? JSON.parse(x.pedido) : null })) });
      }
      if (request.method === 'POST') {
        const corpo = await request.json() as { itens?: { cliente: string; perfil: unknown; aplicado?: boolean; erro?: string | null }[] };
        const agora = Date.now();
        const stmts = (corpo.itens ?? []).slice(0, 100).filter((i) => /^\d{1,12}$/.test(String(i.cliente))).map((i) => env.MOBILE_DB!.prepare(
          `INSERT INTO mobile_perfil(cliente, perfil, publicado_em, pedido, pedido_em, erro) VALUES (?, ?, ?, NULL, NULL, ?)
           ON CONFLICT(cliente) DO UPDATE SET perfil = excluded.perfil, publicado_em = excluded.publicado_em, erro = excluded.erro,
             pedido = CASE WHEN ? THEN NULL ELSE pedido END, pedido_em = CASE WHEN ? THEN NULL ELSE pedido_em END`,
        ).bind(String(i.cliente), JSON.stringify(i.perfil ?? null), agora, i.erro ?? null, i.aplicado ? 1 : 0, i.aplicado ? 1 : 0));
        if (stmts.length) await env.MOBILE_DB.batch(stmts);
        return json(200, { ok: true, gravados: stmts.length });
      }
      return json(405, { erro: 'Método não permitido.' });
    }

    const conta = await authenticateMobileRequest(request, env);
    if (!conta) return json(401, { erro: 'Entre na sua conta.' });
    const link = await env.MOBILE_DB.prepare('SELECT customer_id FROM mobile_identity_links WHERE account_id = ?').bind(conta.id).first<{ customer_id: string }>();
    if (!link) return json(404, { erro: 'Sua conta ainda não está ligada ao seu cadastro no kartódromo. Isso acontece sozinho em alguns minutos depois do cadastro; se demorar, fale com a recepção.' });
    const atual = await env.MOBILE_DB.prepare('SELECT perfil, publicado_em, pedido, erro FROM mobile_perfil WHERE cliente = ?').bind(link.customer_id)
      .first<{ perfil: string | null; publicado_em: number | null; pedido: string | null; erro: string | null }>();
    if (request.method === 'GET') {
      return json(200, { perfil: atual?.perfil ? JSON.parse(atual.perfil) : null, pendente: atual?.pedido ? JSON.parse(atual.pedido) : null, erro: atual?.erro ?? null, atualizadoEm: atual?.publicado_em ? new Date(atual.publicado_em).toISOString() : null });
    }
    if (request.method === 'PUT') {
      const v = validarPerfil(await request.json() as Record<string, unknown>);
      if (!v.ok) return json(400, { erro: v.erro });
      const pedido = { ...(atual?.pedido ? JSON.parse(atual.pedido) as object : {}), ...v.dados };
      await env.MOBILE_DB.prepare(`INSERT INTO mobile_perfil(cliente, pedido, pedido_em, erro) VALUES (?, ?, ?, NULL)
        ON CONFLICT(cliente) DO UPDATE SET pedido = excluded.pedido, pedido_em = excluded.pedido_em, erro = NULL`).bind(link.customer_id, JSON.stringify(pedido), Date.now()).run();
      return json(202, { pendente: pedido, mensagem: 'Recebido! Seu cadastro no kartódromo é atualizado em até 1 minuto.' });
    }
    return json(405, { erro: 'Método não permitido.' });
  } catch {
    return json(503, { erro: 'Serviço temporariamente indisponível.' });
  }
}
