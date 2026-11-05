import { authenticateMobileRequest, mobileAccountCpf, type MobileAuthEnv } from './auth';

type Env = MobileAuthEnv;
type PreviewInput = { codigo: string; bateriaId: number; quantidade: number };
type PreviewRow = { id: string; account_id: string; codigo: string; bateria_id: number; quantidade: number };
type PreviewResult = { brutoCentavos: number; descontoCentavos: number; totalCentavos: number } | { erro: string };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const unavailable = () => json(503, { erro: 'Serviço temporariamente indisponível.' });
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function body(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 4096) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function previewInput(value: Record<string, unknown>): PreviewInput | null {
  const codigo = typeof value.codigo === 'string' ? value.codigo.trim().toUpperCase() : '';
  const bateriaId = Number(value.bateriaId);
  const quantidade = Number(value.quantidade);
  if (!/^[A-Z0-9_-]{1,40}$/.test(codigo) || !Number.isSafeInteger(bateriaId) || bateriaId < 1 ||
      !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10) return null;
  return { codigo, bateriaId, quantidade };
}

async function createPreview(request: Request, env: Env) {
  if (!env.MOBILE_DB) return unavailable();
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json(401, { erro: 'Entre novamente para continuar.' });
  const inputBody = await body(request);
  if (!inputBody) return json(400, { erro: 'Envio inválido.' });
  const input = previewInput(inputBody);
  if (!input) return json(400, { erro: 'Informe um cupom e uma bateria válidos.' });

  const now = Date.now();
  await env.MOBILE_DB.prepare('DELETE FROM mobile_coupon_previews WHERE expires_at <= ?').bind(now).run();
  const pending = await env.MOBILE_DB.prepare(
    `SELECT COUNT(*) count FROM mobile_coupon_previews
     WHERE account_id = ? AND state = 'pending' AND expires_at > ?`,
  ).bind(account.id, now).first<{ count: number }>();
  if (Number(pending?.count ?? 0) >= 5) return json(429, { erro: 'Aguarde a conclusão de uma prévia antes de enviar outra.' });

  const id = crypto.randomUUID();
  await env.MOBILE_DB.prepare(
    `INSERT INTO mobile_coupon_previews(id, account_id, codigo, bateria_id, quantidade, state, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(id, account.id, input.codigo, input.bateriaId, input.quantidade, now, now + 10 * 60_000).run();
  return json(202, { requestId: id });
}

function publicResult(row: { state: string; result_json: string | null }) {
  if (row.state === 'pending') return { status: 'pending' };
  if (row.state !== 'completed' || !row.result_json) return null;
  try {
    const result = JSON.parse(row.result_json) as Record<string, unknown>;
    if (typeof result.erro === 'string') return { status: 'completed', erro: result.erro.slice(0, 300) };
    const brutoCentavos = Number(result.brutoCentavos);
    const descontoCentavos = Number(result.descontoCentavos);
    const totalCentavos = Number(result.totalCentavos);
    if (![brutoCentavos, descontoCentavos, totalCentavos].every(Number.isSafeInteger) ||
        brutoCentavos < 0 || descontoCentavos < 0 || descontoCentavos > brutoCentavos || totalCentavos !== brutoCentavos - descontoCentavos) return null;
    return { status: 'completed', brutoCentavos, descontoCentavos, totalCentavos };
  } catch {
    return null;
  }
}

async function getPreview(request: Request, env: Env, requestId: string) {
  if (!isUuid(requestId)) return json(404, { erro: 'Prévia não encontrada.' });
  if (!env.MOBILE_DB) return unavailable();
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json(401, { erro: 'Entre novamente para continuar.' });
  const row = await env.MOBILE_DB.prepare(
    `SELECT state, result_json FROM mobile_coupon_previews
     WHERE id = ? AND account_id = ? AND expires_at > ? LIMIT 1`,
  ).bind(requestId, account.id, Date.now()).first<{ state: string; result_json: string | null }>();
  if (!row) return json(404, { erro: 'Prévia não encontrada.' });
  const result = publicResult(row);
  return result ? json(200, result) : unavailable();
}

async function listSyncPreviews(env: Env) {
  if (!env.MOBILE_DB) return unavailable();
  const now = Date.now();
  const rows = await env.MOBILE_DB.prepare(
    `SELECT id, account_id, codigo, bateria_id, quantidade FROM mobile_coupon_previews
     WHERE state = 'pending' AND expires_at > ? ORDER BY created_at LIMIT 50`,
  ).bind(now).all<PreviewRow>();
  const jobs: (PreviewRow & { requestId: string; documento: string })[] = [];
  for (const row of rows.results) {
    const documento = await mobileAccountCpf(env, row.account_id);
    if (documento === null) return unavailable();
    jobs.push({ ...row, requestId: row.id, documento });
  }
  return json(200, jobs.map(({ id: _id, account_id: _account, codigo, bateria_id, quantidade, requestId, documento }) => ({
    requestId, codigo, bateriaId: bateria_id, quantidade, documento,
  })));
}

function validResult(value: Record<string, unknown>): PreviewResult | null {
  if (typeof value.erro === 'string' && value.erro.trim()) return { erro: value.erro.trim().slice(0, 300) };
  const brutoCentavos = Number(value.brutoCentavos);
  const descontoCentavos = Number(value.descontoCentavos);
  const totalCentavos = Number(value.totalCentavos);
  if (![brutoCentavos, descontoCentavos, totalCentavos].every(Number.isSafeInteger) ||
      brutoCentavos < 0 || descontoCentavos < 0 || descontoCentavos > brutoCentavos || totalCentavos !== brutoCentavos - descontoCentavos) return null;
  return { brutoCentavos, descontoCentavos, totalCentavos };
}

async function completeSyncPreview(request: Request, env: Env, requestId: string) {
  if (!isUuid(requestId)) return json(404, { erro: 'Prévia não encontrada.' });
  if (!env.MOBILE_DB) return unavailable();
  const resultBody = await body(request);
  const result = resultBody && validResult(resultBody);
  if (!result) return json(400, { erro: 'Resultado de prévia inválido.' });
  const now = Date.now();
  const updated = await env.MOBILE_DB.prepare(
    `UPDATE mobile_coupon_previews SET state = 'completed', result_json = ?
     WHERE id = ? AND state = 'pending' AND expires_at > ?`,
  ).bind(JSON.stringify(result), requestId, now).run();
  if (updated.meta.changes) return json(200, { ok: true });
  const row = await env.MOBILE_DB.prepare(
    'SELECT state FROM mobile_coupon_previews WHERE id = ? AND expires_at > ? LIMIT 1',
  ).bind(requestId, now).first<{ state: string }>();
  return row?.state === 'completed' ? json(200, { ok: true, repetido: true }) : json(404, { erro: 'Prévia não encontrada.' });
}

export async function handleMobileCoupons(request: Request, env: Env) {
  const path = new URL(request.url).pathname;
  if (path === '/api/mobile/v1/coupons/preview' && request.method === 'POST') return createPreview(request, env);
  const match = path.match(/^\/api\/mobile\/v1\/coupons\/preview\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'GET') return getPreview(request, env, match[1]);
  return json(405, { erro: 'Método não permitido.' });
}

export async function handleMobileCouponsSync(request: Request, env: Env) {
  const path = new URL(request.url).pathname;
  if (path === '/api/sync/mobile/coupons' && request.method === 'GET') return listSyncPreviews(env);
  const match = path.match(/^\/api\/sync\/mobile\/coupons\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'POST') return completeSyncPreview(request, env, match[1]);
  return json(404, { erro: 'Prévia não encontrada.' });
}
