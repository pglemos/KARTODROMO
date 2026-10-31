/**
 * Cliente mínimo da API v5 da Stone/Pagar.me (https://docs.pagar.me): pedido com Pix ou checkout de cartão, consulta e
 * cancelamento. A chave fica só no segredo STONE_API_KEY do Worker (nunca no código nem no navegador).
 * Os dados do cartão são digitados na página da Stone (invoiceUrl), nunca passam por aqui.
 */
export type StoneEnv = { STONE_API_KEY?: string; STONE_URL?: string };

export const stoneLigado = (env: StoneEnv) => Boolean(env.STONE_API_KEY);

async function chamar<T>(env: StoneEnv, caminho: string, init: RequestInit = {}): Promise<T> {
  const base = (env.STONE_URL || 'https://api.pagar.me/core/v5').replace(/\/+$/, '');
  const r = await fetch(base + caminho, {
    ...init,
    headers: { authorization: `Basic ${btoa(`${env.STONE_API_KEY ?? ''}:`)}`, 'content-type': 'application/json', 'user-agent': 'kartodromo-betim-reservas', ...(init.headers ?? {}) },
  });
  const texto = await r.text();
  let corpo: { message?: string } = {};
  try { corpo = texto ? JSON.parse(texto) : {}; } catch { /* resposta sem JSON: o status basta */ }
  if (!r.ok) throw new Error(`Stone ${caminho.split('?')[0]}: ${corpo.message ?? `HTTP ${r.status}`}`);
  return corpo as T;
}

type Transacao = { qr_code?: string; qr_code_url?: string; gateway_response?: { errors?: { message?: string }[] } };
type Charge = { status?: string; payment_method?: string; last_transaction?: Transacao };
type PedidoStone = { id: string; code?: string; status: string; charges?: Charge[]; checkouts?: { payment_url?: string }[] };

export type Cobranca = { id: string; codigo: string; status: string; billingType: string; invoiceUrl: string; pixPayload?: string; pixQrUrl?: string; falha?: string };

/** billingType é o que a recepção lê para mostrar Pix / Crédito / Débito (lib/ops/reserva-online.ts). */
const TIPOS: Record<string, string> = { pix: 'PIX', credit_card: 'CREDIT_CARD', debit_card: 'DEBIT_CARD' };

function normalizar(o: PedidoStone): Cobranca {
  const charge = o.charges?.find((c) => c.status === 'paid') ?? o.charges?.[0];
  const t = charge?.last_transaction;
  return {
    id: o.id,
    codigo: o.code ?? '',
    status: o.status,
    billingType: TIPOS[charge?.payment_method ?? ''] ?? 'CREDIT_CARD',
    invoiceUrl: o.checkouts?.[0]?.payment_url ?? '',
    pixPayload: t?.qr_code,
    pixQrUrl: t?.qr_code_url,
    falha: t?.gateway_response?.errors?.[0]?.message,
  };
}

export async function buscarCobrancaPorReferencia(env: StoneEnv, referencia: string) {
  const r = await chamar<{ data?: PedidoStone[] }>(env, `/orders?code=${encodeURIComponent(referencia)}&size=1`);
  return r.data?.[0] ? normalizar(r.data[0]) : null;
}

/** Data de Brasília (AAAA-MM-DD). */
export function hojeBrasilia(agora = new Date()) {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export type ClienteStone = { nome: string; cpf: string; email: string; celular: string };

/** A Stone exige e-mail no Pix; o da reserva é opcional, então cai no endereço do kartódromo. */
const EMAIL_PADRAO = 'reservas@kartodromodebetim.com.br';

export async function criarCobranca(env: StoneEnv, c: ClienteStone, forma: 'pix' | 'cartao', valorCentavos: number, descricao: string, pedidoId: string, validadeSegundos: number, retorno: string) {
  const pagamento = forma === 'pix'
    ? { payment_method: 'pix', pix: { expires_in: validadeSegundos } }
    : {
        payment_method: 'checkout',
        checkout: {
          expires_in: Math.ceil(validadeSegundos / 60),
          accepted_payment_methods: ['credit_card', 'debit_card'],
          customer_editable: false,
          billing_address_editable: false,
          skip_checkout_success_page: true,
          success_url: retorno,
        },
      };
  const pedido = await chamar<PedidoStone>(env, '/orders', {
    method: 'POST',
    // a mesma chave impede segunda cobrança se a resposta se perder e o pedido for reenviado
    headers: { 'idempotency-key': pedidoId },
    body: JSON.stringify({
      code: pedidoId,
      closed: true,
      items: [{ amount: Math.round(valorCentavos), description: descricao.slice(0, 256), quantity: 1, code: pedidoId }],
      customer: {
        name: c.nome.slice(0, 64),
        email: c.email || EMAIL_PADRAO,
        type: 'individual',
        document: c.cpf,
        document_type: 'CPF',
        phones: { mobile_phone: { country_code: '55', area_code: c.celular.slice(0, 2), number: c.celular.slice(2) } },
      },
      payments: [pagamento],
    }),
  });
  return normalizar(pedido);
}

/** A imagem do QR vem por endereço; a tela do site e a do app recebem em base64, sem depender de outro domínio. */
export async function imagemQr(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`QR do Pix: HTTP ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export const consultar = async (env: StoneEnv, id: string) => normalizar(await chamar<PedidoStone>(env, `/orders/${encodeURIComponent(id)}`));
export const cancelar = (env: StoneEnv, id: string) => chamar<unknown>(env, `/orders/${encodeURIComponent(id)}/closed`, { method: 'PATCH', body: JSON.stringify({ status: 'canceled' }) });

/** Pedidos pagos criados desde a data (AAAA-MM-DD). */
export async function pagasDesde(env: StoneEnv, data: string) {
  const r = await chamar<{ data?: PedidoStone[] }>(env, `/orders?status=paid&created_since=${data}T00:00:00&size=100`);
  return (r.data ?? []).map(normalizar);
}

/** Diagnóstico sem segredos: confirma que a chave é aceita e diz qual ambiente ela usa. */
export async function diagnostico(env: StoneEnv) {
  const r = await chamar<{ paging?: { total?: number } }>(env, '/orders?size=1');
  return { chaveAceita: true, ambiente: env.STONE_API_KEY?.startsWith('sk_test_') ? 'teste' : 'producao', pedidos: r.paging?.total ?? 0 };
}

/** Status do pedido na Stone que vale como pago. */
export const PAGO = new Set(['paid']);
export const EVENTOS_PAGO = new Set(['order.paid']);
