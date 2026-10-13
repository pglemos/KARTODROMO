import { asaasLigado } from '../asaas';
import { agendaPublica, visaoPublica, type EnvReservas, type Pedido } from '../reservas';
import { chaveDocumento, codigoReserva, validarReserva, type Agenda } from '../validar';
import { authenticateMobileRequest, type MobileAccount, type MobileAuthEnv } from './auth';

type Env = EnvReservas & MobileAuthEnv;
type MobileOrderRow = {
  account_id: string;
  idempotency_key: string;
  pedido_id: string;
  request_hash: string;
  codigo: string;
  state: 'creating' | 'ready';
  created_at: number;
};
type ReservationInput = {
  bateriaId: number;
  quantidade: number;
  pilotos: string[];
  forma: 'pix' | 'cartao';
  nascimento: string;
  politica: boolean;
  cupom?: string;
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const missing = () => json(404, { erro: 'Reserva não encontrada.' });
const unavailable = () => json(503, { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' });
const encoder = new TextEncoder();
const sha256 = async (value: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

async function pedidoDaConta(env: Env, accountId: string, pedidoId: string) {
  const row = await env.MOBILE_DB!.prepare(
    `SELECT pedido_id FROM mobile_orders
     WHERE account_id = ? AND pedido_id = ? AND state = 'ready' LIMIT 1`,
  ).bind(accountId, pedidoId).first<{ pedido_id: string }>();
  if (!row) return null;
  const object = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
  return object ? object.json<Pedido>() : null;
}

function publicOrder(order: Pedido) {
  return { ...visaoPublica(order), criadoEm: order.criadoEm };
}

async function listOrders(env: Env, accountId: string) {
  const rows = await env.MOBILE_DB!.prepare(
    `SELECT pedido_id FROM mobile_orders
     WHERE account_id = ? AND state = 'ready' ORDER BY created_at DESC LIMIT 50`,
  ).bind(accountId).all<{ pedido_id: string }>();
  const orders: Record<string, unknown>[] = [];
  for (const row of rows.results) {
    const object = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
    if (object) orders.push(publicOrder(await object.json<Pedido>()));
  }
  return json(200, orders);
}

async function getOrder(env: Env, accountId: string, pedidoId: string) {
  if (!/^[a-f0-9-]{36}$/.test(pedidoId)) return missing();
  const order = await pedidoDaConta(env, accountId, pedidoId);
  return order ? json(200, publicOrder(order)) : missing();
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 16_384) return null;
  const raw = await request.text();
  if (encoder.encode(raw).length > 16_384) return null;
  try {
    const body = JSON.parse(raw) as unknown;
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function reservationData(body: Record<string, unknown>): ReservationInput | null {
  const bateriaId = Number(body.bateriaId);
  const quantidade = Number(body.quantidade);
  const forma = body.forma;
  const cupom = typeof body.cupom === 'string' ? body.cupom.trim().toUpperCase() : '';
  const pilotosEntrada = body.pilotos == null ? [] : body.pilotos;
  if (!Number.isSafeInteger(bateriaId) || bateriaId < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10 ||
      (forma !== 'pix' && forma !== 'cartao') || (body.cupom != null && !/^[A-Z0-9_-]{1,40}$/.test(cupom)) ||
      !Array.isArray(pilotosEntrada) || pilotosEntrada.some((nome) => typeof nome !== 'string')) return null;
  const nascimento = typeof body.nascimento === 'string' ? body.nascimento.trim().slice(0, 10) : '';
  const pilotos = pilotosEntrada.map((nome) => (nome as string).replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, quantidade);
  return { bateriaId, quantidade, pilotos, forma, nascimento, politica: body.politica === true, ...(cupom ? { cupom } : {}) };
}

function reservationInput(body: ReservationInput, account: MobileAccount) {
  return {
    ...body,
    tipoDocumento: 'CPF',
    documento: account.cpf,
    nome: account.name,
    email: account.email,
    telefone: account.phone,
    lgpd: true,
  };
}

function recoveryAgenda(body: ReservationInput): Agenda {
  const bateriaId = body.bateriaId;
  return {
    atualizadoEm: '',
    precoCentavos: 0,
    maxPilotos: 10,
    prazoMin: 15,
    antecedenciaMin: 0,
    horarios: [{ id: bateriaId, inicio: '', nome: '', livres: 10 }],
  };
}

async function createOrder(request: Request, env: Env, account: MobileAccount) {
  const key = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return json(400, { erro: 'Chave de idempotência inválida.' });
  if (!env.MOBILE_DB) return unavailable();
  const body = await parseBody(request);
  if (!body) return json(400, { erro: 'Envio inválido.' });
  const data = reservationData(body);
  if (!data) return json(400, { erro: 'Envio inválido.' });
  const hash = await sha256(JSON.stringify(data));
  let row = await env.MOBILE_DB.prepare(
    'SELECT * FROM mobile_orders WHERE account_id = ? AND idempotency_key = ? LIMIT 1',
  ).bind(account.id, key).first<MobileOrderRow>();
  let isReplay = Boolean(row);
  if (row && row.request_hash !== hash) return json(409, { erro: 'Esta chave já foi usada com outros dados.' });
  let checked: ReturnType<typeof validarReserva>;

  if (row) {
    let existing;
    try {
      existing = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
    } catch {
      return unavailable();
    }
    if (existing) {
      try {
        const order = await existing.json<Pedido>();
        if (order.id !== row.pedido_id) return unavailable();
        if (order.status === 'novo') await env.PRE.put(`reservas/fila/${row.pedido_id}`, order.status);
        if (row.state !== 'ready') {
          await env.MOBILE_DB.prepare(
            `UPDATE mobile_orders SET state = 'ready' WHERE account_id = ? AND idempotency_key = ?`,
          ).bind(account.id, key).run();
        }
        return json(200, { id: order.id, codigo: order.codigo });
      } catch {
        return unavailable();
      }
    }
    // The D1 row exists only after validating this same body; this completes an interrupted R2 write.
    checked = validarReserva(reservationInput(data, account), recoveryAgenda(data));
    if (!checked.ok) return json(400, { erro: checked.erro });
  } else {
    if (!asaasLigado(env)) return json(503, { erro: 'Pagamento online indisponível no momento. Fale com a recepção pelo WhatsApp.' });
    const agendaResponse = await agendaPublica(request, env);
    if (!agendaResponse.ok) return agendaResponse;
    const agenda = await agendaResponse.json() as Agenda & { pagamentoOnline: boolean };
    checked = validarReserva(reservationInput(data, account), agenda);
    if (!checked.ok) return json(400, { erro: checked.erro });
  }

  if (!row) {
    const pedidoId = crypto.randomUUID();
    const now = Date.now();
    const inserted = await env.MOBILE_DB.prepare(
      `INSERT INTO mobile_orders(account_id, idempotency_key, pedido_id, request_hash, codigo, state, created_at)
       VALUES (?, ?, ?, ?, ?, 'creating', ?)
       ON CONFLICT(account_id, idempotency_key) DO NOTHING`,
    ).bind(account.id, key, pedidoId, hash, codigoReserva(), now).run();
    isReplay = inserted.meta.changes === 0;
    row = await env.MOBILE_DB.prepare(
      'SELECT * FROM mobile_orders WHERE account_id = ? AND idempotency_key = ? LIMIT 1',
    ).bind(account.id, key).first<MobileOrderRow>();
    if (!row) return unavailable();
    if (row.request_hash !== hash) return json(409, { erro: 'Esta chave já foi usada com outros dados.' });
  }

  try {
    const existing = await env.PRE.get(`reservas/pedidos/${row.pedido_id}.json`);
    if (existing) {
      const order = await existing.json<Pedido>();
      if (order.id !== row.pedido_id) return unavailable();
      if (order.status === 'novo') await env.PRE.put(`reservas/fila/${row.pedido_id}`, order.status);
      if (row.state !== 'ready') {
        await env.MOBILE_DB.prepare(
          `UPDATE mobile_orders SET state = 'ready' WHERE account_id = ? AND idempotency_key = ?`,
        ).bind(account.id, key).run();
      }
      return json(isReplay ? 200 : 201, { id: order.id, codigo: order.codigo });
    }

    const now = new Date(row.created_at).toISOString();
    const order: Pedido = {
      id: row.pedido_id,
      codigo: row.codigo,
      status: 'novo',
      criadoEm: now,
      atualizadoEm: now,
      bateriaId: checked.dados.bateriaId,
      quantidade: checked.dados.quantidade,
      forma: checked.dados.forma,
      pilotos: checked.dados.pilotos,
      ...(data.cupom ? { cupom: data.cupom } : {}),
      cliente: {
        ...checked.dados.cliente,
        chave: chaveDocumento('CPF', account.cpf),
      },
    };
    await env.PRE.put(`reservas/pedidos/${row.pedido_id}.json`, JSON.stringify(order), {
      httpMetadata: { contentType: 'application/json' },
    });
    await env.PRE.put(`reservas/fila/${row.pedido_id}`, order.status);
    await env.MOBILE_DB.prepare(
      `UPDATE mobile_orders SET state = 'ready' WHERE account_id = ? AND idempotency_key = ?`,
    ).bind(account.id, key).run();
    return json(isReplay ? 200 : 201, { id: order.id, codigo: order.codigo });
  } catch {
    return unavailable();
  }
}

export async function handleMobileReservations(request: Request, env: Env) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/mobile/v1/agenda' && request.method === 'GET') return agendaPublica(request, env);
  if (pathname !== '/api/mobile/v1/reservations' && !pathname.startsWith('/api/mobile/v1/reservations/')) {
    return json(404, { erro: 'Rota desconhecida.' });
  }
  const account = await authenticateMobileRequest(request, env);
  if (!account) return json(401, { erro: 'Sessão inválida ou expirada.' });
  if (!env.MOBILE_DB) return unavailable();
  if (pathname === '/api/mobile/v1/reservations') {
    if (request.method === 'POST') return createOrder(request, env, account);
    if (request.method === 'GET') return listOrders(env, account.id);
    return json(405, { erro: 'Método não permitido.' });
  }
  if (request.method === 'GET') {
    return getOrder(env, account.id, pathname.slice('/api/mobile/v1/reservations/'.length));
  }
  return json(405, { erro: 'Método não permitido.' });
}
