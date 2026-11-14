/**
 * Cancelamento pelo próprio cliente em Minhas reservas (13/11/2026, paridade com o Granja Viana, decisão do dono:
 * estorno automático). Regra da Política de Cancelamento (src/config/politica-cancelamento.ts):
 *   - 48 h ou mais antes da largada: estorno de 90% do valor pago (10% de taxa administrativa/operacional), pelo Asaas;
 *   - menos de 48 h: pode cancelar e liberar a vaga, mas sem reembolso.
 * Não cancela pelo site: reserva "cada um paga o seu" (cada amigo pagou a própria vaga), com check-in feito,
 * já começada ou sem pagamento no Asaas. Esses casos vão para a recepção.
 * O SRVKART busca /api/sync/cancelamentos e cancela as inscrições (ReservaOnline.Status = 'cancelado').
 */
import { chamar, type AsaasEnv } from './asaas';
import { avisarPorEmail } from './emails-reserva';
import { indexarPedido, minhasReservas } from './extras';
import type { MobileEmailEnv } from './mobile/email';

type R2 = {
  get(key: string): Promise<{ json<T = unknown>(): Promise<T> } | null>;
  put(key: string, value: string, opts?: unknown): Promise<unknown>;
  list(opts: { prefix: string }): Promise<{ objects: { key: string }[] }>;
  delete(key: string): Promise<unknown>;
};
export type EnvCancelamento = AsaasEnv & MobileEmailEnv & { PRE: R2 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const JSON_R2 = { httpMetadata: { contentType: 'application/json' } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export const PRAZO_REEMBOLSO_H = 48;
export const PERCENTUAL_REEMBOLSO = 0.90;

type PedidoCompleto = {
  id: string; codigo: string; status: string; quantidade: number; forma: 'pix' | 'cartao'; modo?: 'individual';
  cliente: { nome: string; email?: string; documento?: string };
  servidor?: { valorCentavos: number; expiraEm: string; descricao: string; inicio: string };
  pagamento?: { asaasId: string; billingType: string; pagoEm: string; valorCentavos: number };
  cancelamento?: { em: string; reembolsoCentavos: number; horasAntes: number; estornoId?: string | null };
  emails?: Record<string, string>;
  atualizadoEm?: string;
};

const inicioMs = (inicio?: string | null) => (inicio ? Date.parse(String(inicio).slice(0, 16) + ':00-03:00') : NaN);

/** Quanto volta se cancelar agora (sem efeito colateral): usado pela tela para mostrar antes de confirmar. */
export function calcularCancelamento(p: { valorCentavos: number; inicio?: string | null }, agora = Date.now()) {
  const ini = inicioMs(p.inicio);
  const horasAntes = Number.isFinite(ini) ? (ini - agora) / 3_600_000 : NaN;
  const comReembolso = horasAntes >= PRAZO_REEMBOLSO_H;
  return { horasAntes, comReembolso, reembolsoCentavos: comReembolso ? Math.floor(p.valorCentavos * PERCENTUAL_REEMBOLSO) : 0 };
}

/** POST /api/reservas/cancelar { cpf, codigo, pedidoId, simular? } */
export async function cancelarReserva(env: EnvCancelamento, b: Record<string, unknown>, agora = Date.now()) {
  const cpf = digitos(b.cpf), codigo = String(b.codigo ?? '').trim().toUpperCase(), id = String(b.pedidoId ?? '');
  if (cpf.length !== 11 || !/^[A-Z0-9]{6}$/.test(codigo) || !UUID.test(id)) return json(400, { erro: 'Dados do cancelamento inválidos.' });
  const minhas = await minhasReservas(env as never, cpf, codigo);
  if (!minhas?.reservas.some((x) => x.id === id)) return json(404, { erro: 'Reserva não encontrada para este CPF.' });
  const p = await (await env.PRE.get(`reservas/pedidos/${id}.json`))?.json<PedidoCompleto>();
  if (!p) return json(404, { erro: 'Reserva não encontrada.' });
  if (p.status === 'cancelado') return json(200, { ok: true, repetido: true, reembolsoCentavos: p.cancelamento?.reembolsoCentavos ?? 0 });
  if (p.status !== 'confirmado') return json(409, { erro: 'Só reservas pagas e confirmadas podem ser canceladas por aqui.' });
  if (p.modo === 'individual') return json(409, { erro: 'Nesta reserva cada um pagou a própria vaga. Para cancelar, fale com a recepção pelo WhatsApp.' });
  if (await env.PRE.get(`checkins/${id}.json`)) return json(409, { erro: 'O check-in desta reserva já foi feito. Fale com a recepção.' });
  const valor = Number(p.pagamento?.valorCentavos ?? p.servidor?.valorCentavos ?? 0);
  const c = calcularCancelamento({ valorCentavos: valor, inicio: p.servidor?.inicio }, agora);
  if (!Number.isFinite(c.horasAntes)) return json(409, { erro: 'Horário da bateria não encontrado. Fale com a recepção.' });
  if (c.horasAntes <= 0) return json(409, { erro: 'Esta bateria já começou. Não é possível cancelar.' });
  if (b.simular === true) return json(200, { simulacao: true, valorCentavos: valor, ...c, prazoHoras: PRAZO_REEMBOLSO_H });
  if (c.reembolsoCentavos > 0 && !p.pagamento?.asaasId) return json(409, { erro: 'Não achamos o pagamento desta reserva. Fale com a recepção para o estorno.' });
  if (b.confirmo !== true) return json(400, { erro: 'Confirme o cancelamento.' });

  // trava contra clique duplo: um cancelamento por pedido
  const trava = `reservas/cancelando/${id}`;
  if (await env.PRE.get(trava)) return json(409, { erro: 'O cancelamento já está em andamento. Aguarde alguns segundos.' });
  await env.PRE.put(trava, JSON.stringify({ em: new Date(agora).toISOString() }), JSON_R2);

  let estornoId: string | null = null;
  if (c.reembolsoCentavos > 0) {
    try {
      const r = await chamar<{ id?: string; status?: string }>(env, `/payments/${encodeURIComponent(p.pagamento!.asaasId)}/refund`, {
        method: 'POST', body: JSON.stringify({ value: c.reembolsoCentavos / 100, description: `Cancelamento da reserva ${p.codigo} pelo site (90%)` }),
      });
      estornoId = r?.id ?? null;
    } catch (e) {
      console.error('estorno asaas', p.codigo, (e as Error).message);
      await env.PRE.delete(trava);
      return json(502, { erro: 'Não foi possível fazer o estorno agora. Nada foi cancelado. Tente de novo em instantes ou fale com a recepção.' });
    }
  }
  p.status = 'cancelado';
  p.cancelamento = { em: new Date(agora).toISOString(), reembolsoCentavos: c.reembolsoCentavos, horasAntes: Math.round(c.horasAntes * 10) / 10, estornoId };
  p.atualizadoEm = p.cancelamento.em;
  await avisarPorEmail(env, p as never).catch(() => false);
  await env.PRE.put(`reservas/pedidos/${id}.json`, JSON.stringify(p), JSON_R2);
  await indexarPedido(env as never, p as never).catch(() => undefined);
  await env.PRE.put(`cancelamentos/${id}.json`, JSON.stringify({ pedidoId: id, codigo: p.codigo, em: p.cancelamento.em, reembolsoCentavos: c.reembolsoCentavos, state: 'pending' }), JSON_R2);
  return json(200, { ok: true, reembolsoCentavos: c.reembolsoCentavos });
}

/** /api/sync/cancelamentos: GET lista os pendentes; POST { feitos: [{ key, erro }] } marca. */
export async function cancelamentosSync(req: Request, env: EnvCancelamento) {
  if (req.method === 'GET') {
    const out = [];
    for (const o of ((await env.PRE.list({ prefix: 'cancelamentos/' })).objects ?? []).slice(0, 100)) {
      const c = await (await env.PRE.get(o.key))?.json<Record<string, unknown> & { state?: string }>();
      if (c?.state === 'pending') out.push({ key: o.key, ...c });
    }
    return json(200, { cancelamentos: out });
  }
  const { feitos } = (await req.json().catch(() => ({}))) as { feitos?: { key?: unknown; erro?: unknown }[] };
  for (const f of Array.isArray(feitos) ? feitos.slice(0, 100) : []) {
    const key = String(f.key ?? '');
    if (!/^cancelamentos\/[0-9a-f-]{36}\.json$/.test(key)) continue;
    const c = await (await env.PRE.get(key))?.json<Record<string, unknown>>();
    if (c) await env.PRE.put(key, JSON.stringify({ ...c, state: f.erro ? 'erro' : 'feito', erro: f.erro ? String(f.erro).slice(0, 200) : undefined, feitoEm: new Date().toISOString() }), JSON_R2);
  }
  return json(200, { ok: true });
}
