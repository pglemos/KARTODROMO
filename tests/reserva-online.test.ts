import { afterEach, describe, expect, it, vi } from 'vitest';
import { codigoReserva, idade, validarReserva, type Agenda } from '../workers/pre-cadastro/src/validar';
import { conciliarPagamentos, criarPedido, liberado, situacaoPedido, syncPedidos, syncResultado, visaoPublica, webhookAsaas, type EnvReservas, type Pedido } from '../workers/pre-cadastro/src/reservas';
import { hojeBrasilia } from '../workers/pre-cadastro/src/asaas';
import { descricaoPedido } from '../lib/ops/reserva-online';

const HOJE = new Date('2026-10-01T15:00:00Z');
const agenda: Agenda = {
  atualizadoEm: HOJE.toISOString(), precoCentavos: 14500, maxPilotos: 10, prazoMin: 15, antecedenciaMin: 120,
  horarios: [{ id: 101, inicio: '2026-10-03T09:15', nome: 'BATERIA 09:15', livres: 3 }, { id: 102, inicio: '2026-10-03T09:50', nome: 'BATERIA 09:50', livres: 0 }],
};
const base = {
  bateriaId: 101, quantidade: 2, forma: 'pix', politica: true, lgpd: true,
  documento: '529.982.247-25', nome: 'Maria da Silva', email: 'maria@exemplo.com', telefone: '(31) 98888-7777', nascimento: '1990-05-20', peso: '62',
  pilotos: ['Maria da Silva', 'João Silva', 'sobra'],
  acompanhantes: [{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10' }],
};

describe('validarReserva', () => {
  it('aceita um pedido completo: cada vaga com o cadastro de uma pessoa', () => {
    const v = validarReserva(base, agenda, HOJE);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.dados).toMatchObject({ bateriaId: 101, quantidade: 2, forma: 'pix', pilotos: ['Maria da Silva', 'João Silva'] });
      expect(v.dados.acompanhantes).toEqual([{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10' }]);
      expect(v.dados.cliente.tipoDocumento).toBe('CPF');
    }
  });
  it.each([
    [{ bateriaId: 999 }, 'não está mais disponível'],
    [{ bateriaId: 102, quantidade: 1 }, 'lotou'],
    [{ quantidade: 4 }, 'só 3 vagas'],
    [{ quantidade: 0 }, 'de 1 a 10'],
    [{ forma: 'boleto' }, 'Pix ou cartão'],
    [{ politica: false }, 'Política de Cancelamento, Reagendamento e Reembolso'],
    [{ documento: '123.456.789-00' }, 'CPF inválido'],
    [{ nascimento: '2010-01-01' }, 'adulto'],
  ])('recusa %o', (mudanca, trecho) => {
    const v = validarReserva({ ...base, ...mudanca }, agenda, HOJE);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.erro).toContain(trecho);
  });
  it('1 vaga não precisa de outros pilotos', () => {
    const v = validarReserva({ ...base, quantidade: 1, acompanhantes: [] }, agenda, HOJE);
    expect(v.ok).toBe(true);
  });
  it.each([
    [{ acompanhantes: [] }, 'Cadastre o outro piloto'],
    [{ quantidade: 3, acompanhantes: [{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10' }] }, 'Cadastre os outros 2 pilotos'],
    [{ acompanhantes: [{ nome: 'João', documento: '111.444.777-35', nascimento: '2008-03-10' }] }, 'nome completo do piloto 2'],
    [{ acompanhantes: [{ nome: 'João Silva', documento: '111.444.777-00', nascimento: '2008-03-10' }] }, 'CPF inválido do piloto 2'],
    [{ acompanhantes: [{ nome: 'Maria Outra', documento: '529.982.247-25', nascimento: '2008-03-10' }] }, 'repete o de outro piloto'],
    [{ quantidade: 3, acompanhantes: [{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10' }, { nome: 'Pedro Silva', documento: '111.444.777-35', nascimento: '2001-01-01' }] }, 'repete o de outro piloto'],
    [{ acompanhantes: [{ nome: 'Ana Silva', documento: '111.444.777-35', nascimento: '2013-01-01' }] }, '14 anos ou mais'],
  ])('mais de uma vaga exige uma pessoa diferente em cada uma: %o', (mudanca, trecho) => {
    const v = validarReserva({ ...base, ...mudanca }, agenda, HOJE);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.erro).toContain(trecho);
  });
  it('quem compra pode não pilotar: aí cada vaga precisa de um cadastro', () => {
    const doisFilhos = [{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10' }, { nome: 'Pedro Silva', documento: '390.533.447-05', nascimento: '2010-06-15' }];
    const v = validarReserva({ ...base, compradorPilota: false, acompanhantes: doisFilhos }, agenda, HOJE);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.dados).toMatchObject({ compradorPilota: false, pilotos: ['João Silva', 'Pedro Silva'] });
    const falta = validarReserva({ ...base, compradorPilota: false }, agenda, HOJE);
    expect(falta.ok).toBe(false);
    if (!falta.ok) expect(falta.erro).toContain('Cadastre os 2 pilotos');
    const um = validarReserva({ ...base, quantidade: 1, compradorPilota: false, acompanhantes: [] }, agenda, HOJE);
    expect(um.ok).toBe(false);
    if (!um.ok) expect(um.erro).toContain('Cadastre quem vai pilotar');
  });
  it('sem agenda publicada pede para tentar de novo', () => {
    const v = validarReserva(base, null, HOJE);
    expect(v.ok).toBe(false);
  });
  it('idade completa só no dia do aniversário', () => {
    expect(idade('2008-10-01', HOJE)).toBe(18);
    expect(idade('2008-10-02', HOJE)).toBe(17);
  });
});

describe('codigoReserva', () => {
  it('tem 6 caracteres sem letras que se confundem', () => {
    const c = codigoReserva((n) => new Uint8Array(Array.from({ length: n }, (_, i) => i * 7)));
    expect(c).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    for (let i = 0; i < 50; i++) expect(codigoReserva()).not.toMatch(/[01ILO]/);
  });
});

describe('descricaoPedido e vencimento', () => {
  it('monta o texto da cobrança', () => {
    expect(descricaoPedido('BATERIA 09:15', '2026-10-03T09:15', 2)).toBe('Kartódromo de Betim · BATERIA 09:15 · 03/10/2026 09:15 · 2 pilotos');
    expect(descricaoPedido('BATERIA 17:00', '2026-10-03T17:00', 1)).toContain('1 piloto');
  });
  it('vencimento no dia de Brasília (23h em Brasília ainda é o mesmo dia)', () => {
    expect(hojeBrasilia(new Date('2026-10-02T01:30:00Z'))).toBe('2026-10-01');
  });
});

// ---------------------------------------------------------------- fluxo do site com R2 e Asaas simulados

function r2() {
  const m = new Map<string, string>();
  const bucket = {
    get: async (k: string) => (m.has(k) ? { key: k, json: async () => JSON.parse(m.get(k)!), text: async () => m.get(k)! } : null),
    head: async (k: string) => (m.has(k) ? { key: k } : null),
    put: async (k: string, v: string) => { m.set(k, v); },
    list: async ({ prefix = '' }: { prefix?: string } = {}) => ({ objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
    delete: async (k: string | string[]) => { for (const x of Array.isArray(k) ? k : [k]) m.delete(x); },
  };
  return { m, bucket: bucket as unknown as R2Bucket };
}

function ctx() {
  const pendentes: Promise<unknown>[] = [];
  return { c: { waitUntil: (p: Promise<unknown>) => { pendentes.push(p); } } as ExecutionContext, esperar: () => Promise.all(pendentes) };
}

function asaasFalsa() {
  const chamadas: { metodo: string; caminho: string; corpo?: unknown }[] = [];
  const f = vi.fn(async (url: string, init: RequestInit = {}) => {
    const caminho = String(url).replace('https://api-sandbox.asaas.com/v3', '');
    chamadas.push({ metodo: init.method ?? 'GET', caminho, corpo: init.body ? JSON.parse(String(init.body)) : undefined });
    const resp = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (caminho.startsWith('/customers?')) return resp({ data: [] });
    if (caminho === '/customers') return resp({ id: 'cus_1' });
    if (caminho === '/payments' && init.method === 'POST') return resp({ id: 'pay_1', invoiceUrl: 'https://sandbox.asaas.com/i/pay_1', status: 'PENDING', billingType: 'PIX' });
    if (caminho === '/payments/pay_1/pixQrCode') return resp({ encodedImage: 'QUJD', payload: '000201PIX', expirationDate: '2026-10-01 23:59:59' });
    if (caminho === '/payments/pay_1' && init.method === 'DELETE') return resp({ deleted: true });
    if (caminho === '/payments/pay_1') return resp({ id: 'pay_1', status: 'PENDING', billingType: 'PIX', invoiceUrl: '' });
    return new Response('{}', { status: 404 });
  });
  return { f, chamadas };
}

const PREVIA = 'previa-secreta-de-teste';
function ambiente() {
  const { m, bucket } = r2();
  const env: EnvReservas = { PRE: bucket, ASAAS_API_KEY: '$aact_hmlg_teste', ASAAS_URL: 'https://api-sandbox.asaas.com/v3', ASAAS_WEBHOOK_TOKEN: 'w'.repeat(40), RESERVAS_ATIVAS: '0', RESERVAS_PREVIA: PREVIA };
  return { m, env };
}
const pedir = (corpo: unknown, previa = PREVIA) =>
  new Request(`https://reservas.kartodromodebetim.com.br/api/reservas?previa=${previa}`, { method: 'POST', body: JSON.stringify(corpo) });
const semLimite = async () => false;

afterEach(() => vi.unstubAllGlobals());

describe('fluxo da reserva no site', () => {
  it('fechado ao público sem RESERVAS_ATIVAS nem prévia', async () => {
    const { env } = ambiente();
    expect(liberado(new Request('https://x/api/agenda'), env)).toBe(false);
    expect(liberado(new Request(`https://x/api/agenda?previa=${PREVIA}`), env)).toBe(true);
    const r = await criarPedido(pedir({ ...base, t: Date.now() - 10_000 }, 'errada'), env, semLimite);
    expect(r.status).toBe(403);
  });

  it('pedido → vaga segurada → Pix → aviso da Asaas → confirmado', async () => {
    const { m, env } = ambiente();
    m.set('reservas/agenda.json', JSON.stringify(agenda));
    const asaas = asaasFalsa();
    vi.stubGlobal('fetch', asaas.f);

    // 1. cliente envia
    const r = await criarPedido(pedir({ ...base, t: Date.now() - 10_000 }), env, semLimite);
    expect(r.status).toBe(201);
    const { id, codigo } = (await r.json()) as { id: string; codigo: string };
    expect(codigo).toHaveLength(6);

    // 2. servidor busca e segura as vagas
    const fila = (await (await syncPedidos(env)).json()) as Pedido[];
    expect(fila.map((p) => p.id)).toEqual([id]);
    expect(fila[0].cliente.chave).toBe('52998224725');
    const k1 = ctx();
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'reservado', valorCentavos: 29000, expiraEm: '2026-10-01T12:15:00-03:00', descricao: 'Kartódromo de Betim · BATERIA 09:15', inicio: '2026-10-03T09:15' }]) }), env, k1.c);
    await k1.esperar();
    const cobranca = asaas.chamadas.find((c) => c.caminho === '/payments' && c.metodo === 'POST')!;
    expect(cobranca.corpo).toMatchObject({ customer: 'cus_1', billingType: 'PIX', value: 290, externalReference: id });
    expect(((await (await syncPedidos(env)).json()) as Pedido[]).length).toBe(0);

    const tela = (await (await situacaoPedido(env, id, k1.c)).json()) as ReturnType<typeof visaoPublica>;
    expect(tela).toMatchObject({ status: 'aguardando_pagamento', pix: { payload: '000201PIX', imagem: 'QUJD' }, valorCentavos: 29000, nome: 'Maria' });
    expect(JSON.stringify(tela)).not.toContain('52998224725');

    // 3. aviso da Asaas: token errado é recusado; o certo marca pago (repetido não muda nada)
    const aviso = (token: string) => new Request('https://x/api/asaas/webhook', { method: 'POST', headers: { 'asaas-access-token': token }, body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', externalReference: id, billingType: 'PIX' } }) });
    expect((await webhookAsaas(aviso('x'.repeat(40)), env)).status).toBe(401);
    expect((await webhookAsaas(aviso('w'.repeat(40)), env)).status).toBe(200);
    expect((await webhookAsaas(aviso('w'.repeat(40)), env)).status).toBe(200);
    const pagos = (await (await syncPedidos(env)).json()) as Pedido[];
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({ status: 'pago', pagamento: { asaasId: 'pay_1', billingType: 'PIX' } });

    // 4. servidor confirma
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'confirmado', codigo }]) }), env, ctx().c);
    const fim = (await (await situacaoPedido(env, id, ctx().c)).json()) as ReturnType<typeof visaoPublica>;
    expect(fim).toMatchObject({ status: 'confirmado', codigo, pix: null });
    expect(((await (await syncPedidos(env)).json()) as Pedido[]).length).toBe(0);
  });

  it('sem pagamento no prazo: expira e cancela a cobrança na Asaas', async () => {
    const { m, env } = ambiente();
    m.set('reservas/agenda.json', JSON.stringify(agenda));
    const asaas = asaasFalsa();
    vi.stubGlobal('fetch', asaas.f);
    const { id } = (await (await criarPedido(pedir({ ...base, forma: 'cartao', quantidade: 1, t: Date.now() - 10_000 }), env, semLimite)).json()) as { id: string };
    const k = ctx();
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'reservado', valorCentavos: 14500, expiraEm: '2026-10-01T12:15:00-03:00', descricao: 'x', inicio: '2026-10-03T09:15' }]) }), env, k.c);
    await k.esperar();
    const tela = (await (await situacaoPedido(env, id, k.c)).json()) as ReturnType<typeof visaoPublica>;
    expect(tela).toMatchObject({ forma: 'cartao', invoiceUrl: 'https://sandbox.asaas.com/i/pay_1', pix: null });
    expect(asaas.chamadas.some((c) => c.caminho.endsWith('pixQrCode'))).toBe(false);
    const k2 = ctx();
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'expirado' }]) }), env, k2.c);
    await k2.esperar();
    expect(asaas.chamadas.some((c) => c.caminho === '/payments/pay_1' && c.metodo === 'DELETE')).toBe(true);
    expect(((await (await situacaoPedido(env, id, k2.c)).json()) as { status: string }).status).toBe('expirado');
  });

  it('Pix pago sem aviso e com a página fechada: a conferência com a Asaas acha e manda para o servidor (ACEXRJ, 12/10)', async () => {
    const { m, env } = ambiente();
    m.set('reservas/agenda.json', JSON.stringify(agenda));
    const asaas = asaasFalsa();
    vi.stubGlobal('fetch', asaas.f);
    const { id } = (await (await criarPedido(pedir({ ...base, t: Date.now() - 10_000 }), env, semLimite)).json()) as { id: string };
    const k = ctx();
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'reservado', valorCentavos: 29000, expiraEm: '2026-10-01T12:15:00-03:00', descricao: 'x', inicio: '2026-10-03T09:15' }]) }), env, k.c);
    await k.esperar();
    // o servidor venceu o prazo (o aviso foi para o endereço antigo)
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'expirado' }]) }), env, ctx().c);
    // a Asaas tem o Pix recebido
    asaas.f.mockImplementation(async (url: string) => {
      const caminho = String(url).replace('https://api-sandbox.asaas.com/v3', '');
      const pagas = caminho.startsWith('/payments?status=RECEIVED') ? [{ id: 'pay_1', status: 'RECEIVED', billingType: 'PIX', externalReference: id }, { id: 'pay_9', status: 'RECEIVED', billingType: 'PIX', externalReference: 'outra-coisa' }] : [];
      return new Response(JSON.stringify({ data: pagas }), { status: 200 });
    });
    expect(await conciliarPagamentos(env, Date.now() + 3_600_000)).toBe(1);
    expect(await conciliarPagamentos(env, Date.now() + 3_600_000)).toBe(0); // a mesma conferência não repete dentro do minuto
    const fila = (await (await syncPedidos(env)).json()) as Pedido[];
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ id, status: 'pago', pagamento: { asaasId: 'pay_1', billingType: 'PIX' } });

    // "pago" no site mas fora da fila (nunca chegou à recepção): a conferência põe de volta
    m.delete(`reservas/fila/${id}`);
    expect(((await (await syncPedidos(env)).json()) as Pedido[]).length).toBe(0);
    expect(await conciliarPagamentos(env, Date.now() + 7_200_000)).toBe(1);
    expect(((await (await syncPedidos(env)).json()) as Pedido[]).map((p) => p.id)).toEqual([id]);
  });

  it('recusa envio rápido demais (robô) e horário lotado', async () => {
    const { m, env } = ambiente();
    m.set('reservas/agenda.json', JSON.stringify(agenda));
    expect((await criarPedido(pedir({ ...base, t: Date.now() }), env, semLimite)).status).toBe(400);
    const r = await criarPedido(pedir({ ...base, bateriaId: 102, quantidade: 1, t: Date.now() - 10_000 }), env, semLimite);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { erro: string }).erro).toContain('lotou');
  });
});
