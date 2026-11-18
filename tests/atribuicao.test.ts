import { afterEach, describe, expect, it, vi } from 'vitest';
import { CODIGO_NAVEGADOR, SCRIPT_ATRIBUICAO, atribuicaoDaRequisicao, capturarNoNavegador, decodificarToque } from '../src/config/atribuicao';
import { dadosNormalizados, deveEnviar, montarEventoCompra, registrarCompraNaMeta, type PedidoParaConversao } from '../workers/pre-cadastro/src/conversao-meta';
import { criarPedido, syncResultado, webhookAsaas, type EnvReservas, type Pedido } from '../workers/pre-cadastro/src/reservas';

afterEach(() => vi.unstubAllGlobals());

/** Janela falsa com cookie de verdade (por nome; guarda os atributos para conferir). */
function janela(href: string, referrer = '', cookieInicial = '') {
  const url = new URL(href);
  const jarra = new Map<string, string>();
  const escritas: string[] = [];
  for (const p of cookieInicial.split(/;\s*/).filter(Boolean)) jarra.set(p.split('=')[0]!, p.slice(p.indexOf('=') + 1));
  const document = {
    referrer,
    get cookie() { return [...jarra].map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(s: string) { escritas.push(s); const [par] = s.split(';'); const i = par!.indexOf('='); jarra.set(par!.slice(0, i), par!.slice(i + 1)); },
  };
  const w = { document, location: { hostname: url.hostname, protocol: url.protocol, search: url.search, pathname: url.pathname } } as unknown as Window;
  return { w, jarra, escritas };
}

describe('captura no navegador', () => {
  it('grava o toque de campanha no domínio inteiro, cria _fbp e _fbc do fbclid', () => {
    const { w, jarra, escritas } = janela('https://kartodromodebetim.com.br/eventos?utm_source=instagram&utm_campaign=happy+hour&fbclid=AbC123', 'https://l.instagram.com/');
    capturarNoNavegador(w);
    const toque = decodificarToque(jarra.get('kib_atr'));
    expect(toque).toMatchObject({ utm_source: 'instagram', utm_campaign: 'happy hour', fbclid: 'AbC123', pagina: '/eventos', origem: 'l.instagram.com' });
    expect(jarra.get('_fbc')).toMatch(/^fb\.1\.\d{13}\.AbC123$/);
    expect(jarra.get('_fbp')).toMatch(/^fb\.1\.\d{13}\.\d{10}$/);
    for (const e of escritas) expect(e).toContain('domain=.kartodromodebetim.com.br');
    expect(escritas.every((e) => e.includes('secure') && e.includes('samesite=lax') && e.includes('max-age=7776000'))).toBe(true);
  });

  it('visita sem campanha não apaga o toque anterior nem troca o _fbp', () => {
    const { w, jarra } = janela('https://reservas.kartodromodebetim.com.br/', '', 'kib_atr=ANTIGO; _fbp=fb.1.1700000000000.1234567890');
    capturarNoNavegador(w);
    expect(jarra.get('kib_atr')).toBe('ANTIGO');
    expect(jarra.get('_fbp')).toBe('fb.1.1700000000000.1234567890');
    expect(jarra.has('_fbc')).toBe(false);
  });

  it('o script injetado no site é o mesmo código e roda sozinho', () => {
    expect(SCRIPT_ATRIBUICAO).toContain(CODIGO_NAVEGADOR);
    expect(SCRIPT_ATRIBUICAO).not.toContain('__name');
    const { w, jarra } = janela('https://kartodromodebetim.com.br/?gclid=G-1');
    const corpo = SCRIPT_ATRIBUICAO.replace(/^<script>/, '').replace(/<\/script>$/, '');
    new Function('window', corpo)(w);
    expect(decodificarToque(jarra.get('kib_atr'))).toMatchObject({ gclid: 'G-1' });
  });
});

describe('leitura no servidor', () => {
  const cookieDe = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

  it('lê o toque, os cookies da Meta, o IP e o navegador', () => {
    const req = new Request('https://reservas.kartodromodebetim.com.br/api/reservas', {
      headers: {
        cookie: `outro=1; kib_atr=${cookieDe({ utm_source: 'meta', fbclid: 'X', em: 1 })}; _fbp=fb.1.1700000000000.1234567890; _fbc=fb.1.1700000000000.X`,
        'x-forwarded-for': '200.1.2.3, 10.0.0.1',
        'user-agent': 'Mozilla/5.0 Teste',
      },
    });
    expect(atribuicaoDaRequisicao(req)).toEqual({
      toque: { utm_source: 'meta', fbclid: 'X', em: 1 },
      fbp: 'fb.1.1700000000000.1234567890',
      fbc: 'fb.1.1700000000000.X',
      ip: '200.1.2.3',
      navegador: 'Mozilla/5.0 Teste',
    });
  });

  it('cookie forjado não entra: só chaves conhecidas, só texto, com teto; fbp fora do formato some', () => {
    const t = decodificarToque(cookieDe({ utm_source: 'x'.repeat(500), senha: 'nao', em: 'ontem', utm_medium: 42 }));
    expect(t).toEqual({ utm_source: 'x'.repeat(200) });
    expect(decodificarToque('lixo!!')).toBeNull();
    expect(decodificarToque(cookieDe({ pagina: '/so-pagina' }))).toBeNull();
    const req = new Request('https://x', { headers: { cookie: '_fbp=<script>' } });
    expect(atribuicaoDaRequisicao(req)).toMatchObject({ toque: null, fbp: null, fbc: null, ip: null, navegador: null });
  });
});

// ---------------------------------------------------------------- Purchase na Meta

const cliente = { nome: 'Maria José da Silva', email: ' Maria@Exemplo.com ', telefone: '(31) 98888-7777', nascimento: '1990-05-20', cep: '32600-000', cidade: 'Betim', estado: 'MG', chave: '52998224725' };
const pedidoBase = (extra: Partial<PedidoParaConversao> = {}): PedidoParaConversao => ({
  id: '11111111-2222-3333-4444-555555555555', codigo: 'ABC123', status: 'confirmado', bateriaId: 101, quantidade: 2, cliente,
  servidor: { descricao: 'BATERIA 09:15' },
  pagamento: { pagoEm: '2026-10-01T15:00:00.000Z', valorCentavos: 29000 },
  atribuicao: { toque: { utm_source: 'instagram', utm_campaign: 'hh' }, fbp: 'fb.1.1.2', fbc: 'fb.1.1.X', ip: '200.1.2.3', navegador: 'UA' },
  ...extra,
});
const ENV = { META_CAPI_TOKEN: 'token-teste', META_DATASET_ID: '1617559156207933' };

describe('Purchase na Meta', () => {
  it('normaliza como a Meta pede', () => {
    expect(dadosNormalizados(cliente)).toEqual({ em: 'maria@exemplo.com', ph: '5531988887777', fn: 'maria', ln: 'silva', db: '19900520', ct: 'betim', st: 'mg', zp: '32600000', country: 'br', external_id: '52998224725' });
  });

  it('só envia confirmado, com valor, com token, uma vez', () => {
    expect(deveEnviar(ENV, pedidoBase())).toBe(true);
    expect(deveEnviar({}, pedidoBase())).toBe(false);
    expect(deveEnviar(ENV, pedidoBase({ status: 'pago' }))).toBe(false);
    expect(deveEnviar(ENV, pedidoBase({ status: 'pago_sem_vaga' }))).toBe(false);
    expect(deveEnviar(ENV, pedidoBase({ pagamento: { pagoEm: 'x', valorCentavos: 0 } }))).toBe(false);
    expect(deveEnviar(ENV, pedidoBase({ conversao: { eventId: 'e', tentativas: 1, enviadaEm: 'ontem' } }))).toBe(false);
    expect(deveEnviar(ENV, pedidoBase({ conversao: { eventId: 'e', tentativas: 5, erro: 'x' } }))).toBe(false);
  });

  it('o evento leva valor, event_id do pedido, dados com hash e a campanha', async () => {
    const e = await montarEventoCompra(pedidoBase());
    expect(e).toMatchObject({
      event_name: 'Purchase', event_id: 'reserva-11111111-2222-3333-4444-555555555555', action_source: 'website', event_time: 1790866800,
      custom_data: { currency: 'BRL', value: 290, order_id: 'ABC123', num_items: 2, utm_source: 'instagram', utm_campaign: 'hh' },
      user_data: { fbp: 'fb.1.1.2', fbc: 'fb.1.1.X', client_ip_address: '200.1.2.3', client_user_agent: 'UA' },
    });
    const ud = e.user_data as Record<string, string[]>;
    expect(ud.em![0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(e)).not.toContain('maria@exemplo.com');
    expect(JSON.stringify(e)).not.toContain('52998224725');
  });

  it('falha fica anotada e tenta de novo; sucesso marca enviada e não repete', async () => {
    const p = pedidoBase();
    const ruim = vi.fn(async () => new Response('{"error":{"message":"x"}}', { status: 400 }));
    expect(await registrarCompraNaMeta(ENV, p, ruim as never)).toBe(true);
    expect(p.conversao).toMatchObject({ tentativas: 1, erro: expect.stringContaining('HTTP 400') });
    const bom = vi.fn(async () => new Response('{"events_received":1}', { status: 200 }));
    expect(await registrarCompraNaMeta(ENV, p, bom as never)).toBe(true);
    expect(p.conversao).toMatchObject({ tentativas: 2, enviadaEm: expect.any(String) });
    expect(await registrarCompraNaMeta(ENV, p, bom as never)).toBe(false);
    expect(bom).toHaveBeenCalledTimes(1);
    const [url, init] = bom.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v22.0/1617559156207933/events');
    expect(String(url)).not.toContain('token');
    expect(JSON.parse(String(init.body))).toMatchObject({ access_token: 'token-teste', data: [{ event_name: 'Purchase' }] });
  });
});

// ---------------------------------------------------------------- do clique à venda, pelo fluxo do site

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

const EXTRA = { instagram: '@piloto.extra', email: 'extra@exemplo.com', telefone: '31977776666', peso: '70', cep: '', endereco: 'Rua A, 10', complemento: '', bairro: 'Centro', cidade: 'Betim' };
const base = {
  bateriaId: 101, quantidade: 2, forma: 'pix', politica: true, lgpd: true,
  documento: '529.982.247-25', nome: 'Maria da Silva', email: 'maria@exemplo.com', instagram: '@maria.silva', telefone: '(31) 98888-7777', nascimento: '1990-05-20', peso: '62',
  pilotos: ['Maria da Silva', 'João Silva'],
  acompanhantes: [{ nome: 'João Silva', documento: '111.444.777-35', nascimento: '2008-03-10', ...EXTRA }],
};

describe('fluxo do site com campanha', () => {
  it('o pedido guarda de onde veio e, confirmado, a venda vai uma vez para a Meta', async () => {
    const { m, bucket } = r2();
    const daqui3dias = new Date(Date.now() + 3 * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10) + 'T15:00';
    m.set('reservas/agenda.json', JSON.stringify({ atualizadoEm: new Date().toISOString(), precoCentavos: 14500, maxPilotos: 10, prazoMin: 15, antecedenciaMin: 120, horarios: [{ id: 101, inicio: daqui3dias, nome: 'BATERIA 15:00', livres: 5 }] }));
    const env: EnvReservas = { PRE: bucket, ASAAS_API_KEY: '$aact_hmlg_teste', ASAAS_URL: 'https://api-sandbox.asaas.com/v3', ASAAS_WEBHOOK_TOKEN: 'w'.repeat(40), RESERVAS_ATIVAS: '1', ...ENV };
    const meta: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = String(url);
      const resp = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (u.startsWith('https://graph.facebook.com/')) { meta.push(JSON.parse(String(init.body))); return resp({ events_received: 1 }); }
      const c = u.replace('https://api-sandbox.asaas.com/v3', '');
      if (c.startsWith('/customers?')) return resp({ data: [] });
      if (c === '/customers') return resp({ id: 'cus_1' });
      if (c === '/payments' && init.method === 'POST') return resp({ id: 'pay_1', invoiceUrl: 'https://x', status: 'PENDING', billingType: 'PIX' });
      if (c === '/payments/pay_1/pixQrCode') return resp({ encodedImage: 'QUJD', payload: '000201PIX' });
      return new Response('{}', { status: 404 });
    }));
    const pendentes: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => { pendentes.push(p); } } as ExecutionContext;

    const toque = Buffer.from(JSON.stringify({ utm_source: 'instagram', utm_campaign: 'hh', fbclid: 'CLK', em: 1 })).toString('base64url');
    const r = await criarPedido(new Request('https://reservas.kartodromodebetim.com.br/api/reservas', {
      method: 'POST',
      headers: { cookie: `kib_atr=${toque}; _fbp=fb.1.1700000000000.1234567890; _fbc=fb.1.1700000000000.CLK`, 'cf-connecting-ip': '200.9.9.9', 'user-agent': 'UA-teste' },
      body: JSON.stringify({ ...base, t: Date.now() - 10_000 }),
    }), env, async () => false);
    if (r.status !== 201) throw new Error(await r.text());
    const { id, codigo } = (await r.json()) as { id: string; codigo: string };
    const lido = () => JSON.parse(m.get(`reservas/pedidos/${id}.json`)!) as Pedido;
    expect(lido().atribuicao).toMatchObject({ toque: { utm_source: 'instagram', fbclid: 'CLK' }, fbc: 'fb.1.1700000000000.CLK', ip: '200.9.9.9', navegador: 'UA-teste' });

    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'reservado', valorCentavos: 29000, expiraEm: '2026-10-01T12:15:00-03:00', descricao: 'BATERIA 09:15', inicio: '2026-10-03T09:15' }]) }), env, ctx);
    await Promise.all(pendentes);
    await webhookAsaas(new Request('https://x', { method: 'POST', headers: { 'asaas-access-token': 'w'.repeat(40) }, body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', externalReference: id, billingType: 'PIX' } }) }), env);
    expect(meta).toHaveLength(0); // pago ainda não é venda (pode virar pago_sem_vaga)

    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'confirmado', codigo }]) }), env, ctx);
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ data: [{ event_name: 'Purchase', event_id: `reserva-${id}`, custom_data: { value: 290, utm_source: 'instagram' }, user_data: { fbc: 'fb.1.1700000000000.CLK' } }] });
    expect(lido().conversao).toMatchObject({ eventId: `reserva-${id}`, enviadaEm: expect.any(String) });

    // confirmação repetida do SRVKART não manda de novo
    await syncResultado(new Request('https://x', { method: 'POST', body: JSON.stringify([{ id, acao: 'confirmado', codigo }]) }), env, ctx);
    expect(meta).toHaveLength(1);
  });
});
