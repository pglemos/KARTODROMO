/**
 * Cliente mínimo da API v3 da Asaas (https://docs.asaas.com): cliente, cobrança Pix ou cartão, QR do Pix,
 * consulta e cancelamento. A chave fica só no segredo ASAAS_API_KEY do Worker (nunca no código nem no navegador).
 * Os dados do cartão são digitados na fatura da Asaas (invoiceUrl), nunca passam por aqui.
 */
export type AsaasEnv = { ASAAS_API_KEY?: string; ASAAS_URL?: string };

export const asaasLigado = (env: AsaasEnv) => Boolean(env.ASAAS_API_KEY);

async function chamar<T>(env: AsaasEnv, caminho: string, init: RequestInit = {}): Promise<T> {
  const base = (env.ASAAS_URL || 'https://api.asaas.com/v3').replace(/\/+$/, '');
  const r = await fetch(base + caminho, {
    ...init,
    headers: { access_token: env.ASAAS_API_KEY ?? '', 'content-type': 'application/json', 'user-agent': 'kartodromo-betim-reservas', ...(init.headers ?? {}) },
  });
  const texto = await r.text();
  const corpo = texto ? JSON.parse(texto) : {};
  if (!r.ok) {
    const msg = (corpo?.errors?.[0]?.description as string | undefined) ?? `HTTP ${r.status}`;
    throw new Error(`Asaas ${caminho.split('?')[0]}: ${msg}`);
  }
  return corpo as T;
}

export type ClienteAsaas = { nome: string; cpf: string; email: string; celular: string; referencia: string };

/** Reaproveita o cliente da Asaas pelo CPF (evita um cadastro novo a cada reserva). */
export async function garantirCliente(env: AsaasEnv, c: ClienteAsaas): Promise<string> {
  const achados = await chamar<{ data: { id: string }[] }>(env, `/customers?cpfCnpj=${encodeURIComponent(c.cpf)}&limit=1`);
  if (achados.data?.[0]?.id) return achados.data[0].id;
  const novo = await chamar<{ id: string }>(env, '/customers', {
    method: 'POST',
    body: JSON.stringify({ name: c.nome, cpfCnpj: c.cpf, email: c.email || undefined, mobilePhone: c.celular, externalReference: c.referencia, notificationDisabled: true }),
  });
  return novo.id;
}

export type Cobranca = { id: string; invoiceUrl: string; status: string; billingType: string };

/** Vencimento no dia (horário de Brasília): a vaga só fica segura por 15 min de qualquer jeito. */
export function hojeBrasilia(agora = new Date()) {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export async function criarCobranca(env: AsaasEnv, cliente: string, forma: 'pix' | 'cartao', valorCentavos: number, descricao: string, pedidoId: string) {
  return chamar<Cobranca>(env, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: cliente,
      // CREDIT_CARD: a fatura da Asaas também oferece débito (Visa/Master); boleto fica de fora (não compensa em 15 min)
      billingType: forma === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: Math.round(valorCentavos) / 100,
      dueDate: hojeBrasilia(),
      description: descricao.slice(0, 500),
      externalReference: pedidoId,
    }),
  });
}

export const qrPix = (env: AsaasEnv, id: string) => chamar<{ encodedImage: string; payload: string; expirationDate: string }>(env, `/payments/${encodeURIComponent(id)}/pixQrCode`);
export const consultar = (env: AsaasEnv, id: string) => chamar<Cobranca>(env, `/payments/${encodeURIComponent(id)}`);
export const cancelar = (env: AsaasEnv, id: string) => chamar<{ deleted: boolean }>(env, `/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Status da Asaas que valem como pago (Pix recebido; cartão confirmado/recebido). */
export const PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
export const EVENTOS_PAGO = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
