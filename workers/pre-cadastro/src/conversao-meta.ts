/**
 * Venda da reserva online na Meta (API de Conversões, evento `Purchase`) — Fase 6 do Kartódromo OS.
 *
 * Quando: a reserva fica CONFIRMADA (o SRVKART garantiu a vaga depois do pagamento). "Pago" ainda pode virar
 * "pago_sem_vaga" e ser devolvido; confirmado é venda. Valor zero (voucher 100%) não é venda para a Meta.
 *
 * Desligado até existir o token: sem `META_CAPI_TOKEN` e `META_DATASET_ID`, nada sai e nada é gravado.
 * O `event_id` é `reserva-<id do pedido>` — o mesmo que um pixel no navegador deve usar, para a Meta deduplicar.
 * Uma vez só por pedido (`p.conversao.enviadaEm`); falha fica em `p.conversao` e tenta de novo na próxima gravação
 * do pedido, até 5 vezes. Nunca lança: a reserva não pode parar por causa da Meta.
 */
import type { AtribuicaoDoPedido } from '../../../src/config/atribuicao';

export interface EnvConversaoMeta {
  META_CAPI_TOKEN?: string;
  META_DATASET_ID?: string;
  /** Versão da Graph API (padrão v22.0, a mesma do CRM). */
  META_GRAPH_VERSION?: string;
  /** Código de teste do Gerenciador de Eventos, para validar sem contar como venda. */
  META_TEST_EVENT_CODE?: string;
}

export type ConversaoDoPedido = { eventId: string; enviadaEm?: string; tentativas: number; erro?: string };

/** O mínimo do pedido que a conversão lê (evita acoplar ao tipo inteiro de reservas.ts). */
export type PedidoParaConversao = {
  id: string;
  codigo: string;
  status: string;
  bateriaId: number;
  quantidade: number;
  cliente: { nome: string; email: string; telefone: string; nascimento: string; cep: string; cidade: string; estado: string; chave: string };
  servidor?: { descricao?: string };
  pagamento?: { pagoEm: string; valorCentavos: number };
  atribuicao?: AtribuicaoDoPedido;
  conversao?: ConversaoDoPedido;
};

export const MAX_TENTATIVAS = 5;
const URL_RESERVAS = 'https://reservas.kartodromodebetim.com.br/';

export function deveEnviar(env: EnvConversaoMeta, p: PedidoParaConversao): boolean {
  if (!env.META_CAPI_TOKEN || !env.META_DATASET_ID) return false;
  if (p.status !== 'confirmado' || !p.pagamento || !(Number(p.pagamento.valorCentavos) > 0)) return false;
  if (p.conversao?.enviadaEm) return false;
  return (p.conversao?.tentativas ?? 0) < MAX_TENTATIVAS;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const so = (s: string) => semAcento(s).toLowerCase().replace(/[^a-z]/g, '');

async function sha256(v: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Normaliza como a Meta pede (minúsculo, sem acento, telefone com 55) e devolve só o que tem valor. */
export function dadosNormalizados(c: PedidoParaConversao['cliente']): Record<string, string> {
  const partes = semAcento(c.nome).toLowerCase().trim().split(/\s+/).filter(Boolean);
  let tel = String(c.telefone ?? '').replace(/\D/g, '');
  if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
  const nasc = /^\d{4}-\d{2}-\d{2}$/.test(c.nascimento ?? '') ? c.nascimento.replace(/-/g, '') : '';
  const d: Record<string, string> = {
    em: String(c.email ?? '').trim().toLowerCase(),
    ph: tel.length >= 12 ? tel : '',
    fn: partes.length ? so(partes[0]!) : '',
    ln: partes.length > 1 ? so(partes[partes.length - 1]!) : '',
    db: nasc,
    ct: so(c.cidade ?? ''),
    st: so(c.estado ?? '').slice(0, 2),
    zp: String(c.cep ?? '').replace(/\D/g, '').slice(0, 8),
    country: 'br',
    external_id: String(c.chave ?? ''),
  };
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v));
}

export async function montarEventoCompra(p: PedidoParaConversao): Promise<Record<string, unknown>> {
  const user_data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dadosNormalizados(p.cliente))) user_data[k] = [await sha256(v)];
  const a = p.atribuicao;
  if (a?.fbc) user_data.fbc = a.fbc;
  if (a?.fbp) user_data.fbp = a.fbp;
  if (a?.ip) user_data.client_ip_address = a.ip;
  if (a?.navegador) user_data.client_user_agent = a.navegador;
  const t = a?.toque;
  const custom_data: Record<string, unknown> = {
    currency: 'BRL',
    value: Math.round(Number(p.pagamento!.valorCentavos)) / 100,
    order_id: p.codigo,
    content_type: 'product',
    content_ids: [`bateria-${p.bateriaId}`],
    num_items: p.quantidade,
  };
  if (p.servidor?.descricao) custom_data.content_name = p.servidor.descricao.slice(0, 200);
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) if (t?.[k]) custom_data[k] = t[k];
  return {
    event_name: 'Purchase',
    event_time: Math.floor(Date.parse(p.pagamento!.pagoEm) / 1000) || Math.floor(Date.now() / 1000),
    event_id: `reserva-${p.id}`,
    action_source: 'website',
    event_source_url: URL_RESERVAS,
    user_data,
    custom_data,
  };
}

/** Envia se for a hora (ver `deveEnviar`) e anota o resultado em `p.conversao`. Devolve se mexeu no pedido. */
export async function registrarCompraNaMeta(env: EnvConversaoMeta, p: PedidoParaConversao, f: typeof fetch = fetch): Promise<boolean> {
  if (!deveEnviar(env, p)) return false;
  const conv: ConversaoDoPedido = { eventId: `reserva-${p.id}`, tentativas: (p.conversao?.tentativas ?? 0) + 1 };
  try {
    const evento = await montarEventoCompra(p);
    const corpo: Record<string, unknown> = { data: [evento], access_token: env.META_CAPI_TOKEN };
    if (env.META_TEST_EVENT_CODE) corpo.test_event_code = env.META_TEST_EVENT_CODE;
    const versao = /^v\d+\.\d+$/.test(env.META_GRAPH_VERSION ?? '') ? env.META_GRAPH_VERSION : 'v22.0';
    const r = await f(`https://graph.facebook.com/${versao}/${encodeURIComponent(env.META_DATASET_ID!)}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      conv.enviadaEm = new Date().toISOString();
    } else {
      const t = await r.text().catch(() => '');
      conv.erro = `HTTP ${r.status} ${t.slice(0, 200)}`;
    }
  } catch (e) {
    conv.erro = (e as Error).message.slice(0, 200);
  }
  if (conv.erro) console.error(`reserva ${p.codigo}: Purchase na Meta falhou (${conv.tentativas}/${MAX_TENTATIVAS}): ${conv.erro}`);
  p.conversao = conv;
  return true;
}
