/**
 * Fila dos e-mails de conta, lida pelo servidor da cronometragem (o mesmo que publica os resultados, com a mesma
 * chave x-mobile-publish-token): pega até 10, envia pela HostGator e avisa enviado (apaga) ou falhou (volta à fila).
 * Retenta enquanto o link vale (30 min); o que ficou parado 2 min sem resposta volta para a fila.
 */
export interface MobileOutboxEnv {
  MOBILE_DB?: D1Database;
  MOBILE_PUBLISH_TOKEN?: string;
}

type Linha = { id: string; to_address: string; subject: string; text_body: string; html_body: string };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function autorizado(request: Request, esperado: string | undefined) {
  const recebido = request.headers.get('x-mobile-publish-token') ?? '';
  if (!esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

export async function handleMobileOutbox(request: Request, env: MobileOutboxEnv) {
  if (!env.MOBILE_DB || !env.MOBILE_PUBLISH_TOKEN) return json(503, { erro: 'Indisponível.' });
  if (!autorizado(request, env.MOBILE_PUBLISH_TOKEN)) return json(401, { erro: 'Não autorizado.' });
  const path = new URL(request.url).pathname;
  const agora = Date.now();
  if (path === '/api/mobile/v1/internal/outbox' && request.method === 'GET') {
    const { results } = await env.MOBILE_DB.prepare(
      `UPDATE mobile_email_outbox SET claimed_at = ?, attempts = attempts + 1
        WHERE id IN (SELECT id FROM mobile_email_outbox
          WHERE (claimed_at IS NULL OR claimed_at < ?) AND created_at > ?
          ORDER BY created_at LIMIT 10)
        RETURNING id, to_address, subject, text_body, html_body`,
    ).bind(agora, agora - 120_000, agora - 30 * 60_000).all<Linha>();
    return json(200, results.map((r) => ({ id: r.id, to: r.to_address, subject: r.subject, text: r.text_body, html: r.html_body })));
  }
  const m = path.match(/^\/api\/mobile\/v1\/internal\/outbox\/([0-9a-f-]{36})\/(enviado|falhou)$/);
  if (m && request.method === 'POST') {
    if (m[2] === 'enviado') await env.MOBILE_DB.prepare('DELETE FROM mobile_email_outbox WHERE id = ?').bind(m[1]).run();
    else await env.MOBILE_DB.prepare('UPDATE mobile_email_outbox SET claimed_at = NULL WHERE id = ?').bind(m[1]).run();
    return json(200, { ok: true });
  }
  return json(404, { erro: 'Rota desconhecida.' });
}
