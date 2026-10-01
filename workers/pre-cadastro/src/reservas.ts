/**
 * Reserva online (reservas.kartodromodebetim.com.br) — lado do site. Guarda os pedidos no R2 até o servidor da recepção
 * (SRVKART) buscar pelo /api/sync, igual ao pré-cadastro. Fluxo de um pedido:
 *   novo → (servidor segura as vagas) aguardando_pagamento → (Asaas avisa) pago → (servidor confirma) confirmado
 *   e os desvios: recusado (sem vaga), expirado (15 min sem pagar), pago_sem_vaga (pagou depois e o horário lotou).
 */
import { asaasLigado, cancelar, consultar, criarCobranca, EVENTOS_PAGO, garantirCliente, PAGO, qrPix, type AsaasEnv } from './asaas';
import { chaveDocumento, codigoReserva, digitos, validarReserva, type Agenda, type PreCadastro } from './validar';

export interface EnvReservas extends AsaasEnv {
  PRE: R2Bucket;
  ASAAS_WEBHOOK_TOKEN?: string;
  RESERVAS_ATIVAS?: string;
  RESERVAS_PREVIA?: string;
}

type Status = 'novo' | 'aguardando_pagamento' | 'pago' | 'confirmado' | 'recusado' | 'expirado' | 'pago_sem_vaga' | 'erro_pagamento';
export type Pedido = {
  id: string;
  codigo: string;
  status: Status;
  criadoEm: string;
  atualizadoEm: string;
  bateriaId: number;
  quantidade: number;
  forma: 'pix' | 'cartao';
  pilotos: string[];
  cliente: PreCadastro & { chave: string };
  servidor?: { valorCentavos: number; expiraEm: string; descricao: string; inicio: string };
  asaas?: { pagamentoId: string; invoiceUrl: string; pixPayload?: string; pixImagem?: string; consultadoEm?: string };
  pagamento?: { asaasId: string; billingType: string; pagoEm: string; valorCentavos: number };
  erro?: string;
};

const json = (status: number, body: unknown, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

const chavePedido = (id: string) => `reservas/pedidos/${id}.json`;
const chaveFila = (id: string) => `reservas/fila/${id}`;
const idValido = (id: string) => /^[a-f0-9-]{36}$/.test(id);

async function lerPedido(env: EnvReservas, id: string) {
  if (!idValido(id)) return null;
  const o = await env.PRE.get(chavePedido(id));
  return o ? await o.json<Pedido>() : null;
}

async function gravarPedido(env: EnvReservas, p: Pedido, naFila: boolean) {
  p.atualizadoEm = new Date().toISOString();
  await env.PRE.put(chavePedido(p.id), JSON.stringify(p), { httpMetadata: { contentType: 'application/json' } });
  if (naFila) await env.PRE.put(chaveFila(p.id), p.status);
  else await env.PRE.delete(chaveFila(p.id));
}

async function agendaAtual(env: EnvReservas) {
  const o = await env.PRE.get('reservas/agenda.json');
  return o ? await o.json<Agenda>() : null;
}

/** Fechado ao público até RESERVAS_ATIVAS=1; antes disso, só com ?previa=<RESERVAS_PREVIA> (testes). */
export function liberado(req: Request, env: EnvReservas) {
  if (env.RESERVAS_ATIVAS === '1') return true;
  const previa = new URL(req.url).searchParams.get('previa') ?? req.headers.get('x-previa') ?? '';
  return Boolean(env.RESERVAS_PREVIA && previa === env.RESERVAS_PREVIA);
}

/** O que a tela do cliente pode ver do pedido (sem documento, endereço etc.). */
export function visaoPublica(p: Pedido) {
  return {
    id: p.id,
    codigo: p.codigo,
    status: p.status,
    forma: p.forma,
    quantidade: p.quantidade,
    nome: p.cliente.nome.split(' ')[0],
    descricao: p.servidor?.descricao ?? null,
    inicio: p.servidor?.inicio ?? null,
    valorCentavos: p.servidor?.valorCentavos ?? null,
    expiraEm: p.servidor?.expiraEm ?? null,
    pix: p.status === 'aguardando_pagamento' && p.asaas?.pixPayload ? { payload: p.asaas.pixPayload, imagem: p.asaas.pixImagem } : null,
    invoiceUrl: p.status === 'aguardando_pagamento' && p.forma === 'cartao' ? p.asaas?.invoiceUrl ?? null : null,
    preparandoPagamento: p.status === 'aguardando_pagamento' && !p.asaas,
    erro: p.erro ?? null,
  };
}

// ---------------------------------------------------------------- cliente (navegador)

export async function criarPedido(req: Request, env: EnvReservas, excedeuLimite: (ip: string) => Promise<boolean>) {
  if (!liberado(req, env)) return json(403, { erro: 'A reserva online ainda não está aberta.' });
  if (!asaasLigado(env)) return json(503, { erro: 'Pagamento online indisponível no momento. Fale com a recepção pelo WhatsApp.' });
  let corpo: Record<string, unknown>;
  try { corpo = (await req.json()) as Record<string, unknown>; } catch { return json(400, { erro: 'Envio inválido.' }); }
  if (String(corpo.site ?? '') !== '') return json(400, { erro: 'Envio inválido.' });
  const aberto = Number(corpo.t ?? 0);
  if (!aberto || Date.now() - aberto < 6000) return json(400, { erro: 'Confira os dados e envie de novo.' });
  if (await excedeuLimite(req.headers.get('cf-connecting-ip') ?? 'x')) return json(429, { erro: 'Muitos pedidos seguidos. Aguarde alguns minutos.' });

  const v = validarReserva(corpo, await agendaAtual(env));
  if (!v.ok) return json(400, { erro: v.erro });
  const agora = new Date().toISOString();
  const p: Pedido = {
    id: crypto.randomUUID(),
    codigo: codigoReserva(),
    status: 'novo',
    criadoEm: agora,
    atualizadoEm: agora,
    bateriaId: v.dados.bateriaId,
    quantidade: v.dados.quantidade,
    forma: v.dados.forma,
    pilotos: v.dados.pilotos,
    cliente: { ...v.dados.cliente, chave: chaveDocumento('CPF', v.dados.cliente.documento) },
  };
  await gravarPedido(env, p, true);
  return json(201, { id: p.id, codigo: p.codigo });
}

/** A tela consulta a cada 2–3 s. Se o aviso da Asaas atrasar, confere direto na Asaas (no máximo a cada 15 s). */
export async function situacaoPedido(env: EnvReservas, id: string, ctx: ExecutionContext) {
  const p = await lerPedido(env, id);
  if (!p) return json(404, { erro: 'Reserva não encontrada.' });
  if (p.status === 'aguardando_pagamento' && p.asaas?.pagamentoId && asaasLigado(env)) {
    const ultima = p.asaas.consultadoEm ? Date.parse(p.asaas.consultadoEm) : 0;
    if (Date.now() - ultima > 15_000) {
      p.asaas.consultadoEm = new Date().toISOString();
      try {
        const c = await consultar(env, p.asaas.pagamentoId);
        const pagou = PAGO.has(c.status) && marcarPago(p, c.id, c.billingType);
        await gravarPedido(env, p, pagou);
      } catch (e) { console.error('consulta asaas', (e as Error).message); }
    }
  }
  void ctx;
  return json(200, visaoPublica(p));
}

export async function agendaPublica(req: Request, env: EnvReservas) {
  if (!liberado(req, env)) return json(403, { erro: 'A reserva online ainda não está aberta.' });
  const a = await agendaAtual(env);
  if (!a) return json(503, { erro: 'A agenda está sendo atualizada. Tente de novo em instantes.' });
  return json(200, { ...a, pagamentoOnline: asaasLigado(env) }, 'public, max-age=15');
}

// ---------------------------------------------------------------- Asaas

function marcarPago(p: Pedido, asaasId: string, billingType: string) {
  if (p.status === 'pago' || p.status === 'confirmado' || p.status === 'pago_sem_vaga') return false;
  p.status = 'pago';
  p.pagamento = { asaasId, billingType, pagoEm: new Date().toISOString(), valorCentavos: p.servidor?.valorCentavos ?? 0 };
  return true;
}

function tokenConfere(recebido: string, esperado: string) {
  if (!esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

/** Aviso da Asaas (pode chegar repetido — só o primeiro "pago" vale). Responde rápido: a Asaas espera 10 s. */
export async function webhookAsaas(req: Request, env: EnvReservas) {
  if (!tokenConfere(req.headers.get('asaas-access-token') ?? '', env.ASAAS_WEBHOOK_TOKEN ?? '')) return json(401, { erro: 'Não autorizado.' });
  const corpo = (await req.json().catch(() => ({}))) as { event?: string; payment?: { id?: string; externalReference?: string; billingType?: string } };
  const ref = corpo.payment?.externalReference ?? '';
  if (!corpo.event || !EVENTOS_PAGO.has(corpo.event) || !idValido(ref)) return json(200, { ok: true, ignorado: true });
  const p = await lerPedido(env, ref);
  if (!p) return json(200, { ok: true, ignorado: true });
  if (marcarPago(p, corpo.payment?.id ?? '', corpo.payment?.billingType ?? '')) await gravarPedido(env, p, true);
  return json(200, { ok: true });
}

/** Servidor segurou as vagas: cria a cobrança (cliente Asaas pelo CPF + cobrança + QR do Pix). */
async function cobrar(env: EnvReservas, p: Pedido) {
  try {
    const cliente = await garantirCliente(env, {
      nome: p.cliente.nome, cpf: digitos(p.cliente.documento), email: p.cliente.email, celular: digitos(p.cliente.telefone), referencia: p.cliente.chave,
    });
    const c = await criarCobranca(env, cliente, p.forma, p.servidor!.valorCentavos, p.servidor!.descricao + ` · reserva ${p.codigo}`, p.id);
    p.asaas = { pagamentoId: c.id, invoiceUrl: c.invoiceUrl };
    if (p.forma === 'pix') {
      const q = await qrPix(env, c.id);
      p.asaas.pixPayload = q.payload;
      p.asaas.pixImagem = q.encodedImage;
    }
  } catch (e) {
    console.error('cobrança asaas', (e as Error).message);
    p.status = 'erro_pagamento';
    p.erro = 'Não conseguimos gerar o pagamento agora. Tente de novo em alguns minutos ou fale com a recepção pelo WhatsApp.';
  }
  const atual = await lerPedido(env, p.id);
  // o aviso de pago pode ter chegado enquanto a cobrança era criada: não sobrescreve
  if (atual && atual.status !== 'aguardando_pagamento') return;
  await gravarPedido(env, p, false);
}

// ---------------------------------------------------------------- servidor da recepção (/api/sync, x-sync-key)

export async function syncPedidos(env: EnvReservas) {
  const fila = await env.PRE.list({ prefix: 'reservas/fila/', limit: 50 });
  const itens: Pedido[] = [];
  for (const o of fila.objects) {
    const p = await lerPedido(env, o.key.slice('reservas/fila/'.length));
    if (p && (p.status === 'novo' || p.status === 'pago')) itens.push(p);
    else await env.PRE.delete(o.key);
  }
  return json(200, itens);
}

export async function syncAgenda(req: Request, env: EnvReservas) {
  const a = (await req.json()) as Agenda;
  if (!Array.isArray(a?.horarios)) return json(400, { erro: 'Agenda inválida.' });
  await env.PRE.put('reservas/agenda.json', JSON.stringify(a), { httpMetadata: { contentType: 'application/json' } });
  return json(200, { horarios: a.horarios.length });
}

type Resultado = { id: string; acao: string; valorCentavos?: number; expiraEm?: string; descricao?: string; inicio?: string; erro?: string; codigo?: string };

export async function syncResultado(req: Request, env: EnvReservas, ctx: ExecutionContext) {
  const lista = (await req.json()) as Resultado[];
  let n = 0;
  for (const r of Array.isArray(lista) ? lista : []) {
    const p = await lerPedido(env, String(r.id));
    if (!p) continue;
    n++;
    if (r.acao === 'reservado' && p.status === 'novo') {
      p.status = 'aguardando_pagamento';
      p.servidor = { valorCentavos: Number(r.valorCentavos), expiraEm: String(r.expiraEm), descricao: String(r.descricao ?? ''), inicio: String(r.inicio ?? '') };
      await gravarPedido(env, p, false);
      ctx.waitUntil(cobrar(env, p));
    } else if (r.acao === 'recusado' && p.status === 'novo') {
      p.status = 'recusado'; p.erro = r.erro ?? 'Esse horário não está mais disponível.';
      await gravarPedido(env, p, false);
    } else if (r.acao === 'confirmado' && (p.status === 'pago' || p.status === 'novo')) {
      p.status = 'confirmado';
      await gravarPedido(env, p, false);
    } else if (r.acao === 'expirado' && (p.status === 'aguardando_pagamento' || p.status === 'erro_pagamento')) {
      p.status = 'expirado';
      await gravarPedido(env, p, false);
      if (p.asaas?.pagamentoId && asaasLigado(env)) ctx.waitUntil(cancelar(env, p.asaas.pagamentoId).then(() => undefined, (e) => console.error('cancelar asaas', (e as Error).message)));
    } else if (r.acao === 'pago_sem_vaga') {
      p.status = 'pago_sem_vaga'; p.erro = r.erro;
      await gravarPedido(env, p, false);
    }
  }
  return json(200, { processados: n });
}
