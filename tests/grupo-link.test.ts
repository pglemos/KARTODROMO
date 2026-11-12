import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../workers/pre-cadastro/src/index';

// Link do grupo (?r=TOKEN) e painel do organizador (/painel?g=&k=): rotas que já sumiram duas vezes
// num deploy (05/11 e 08/11/2026). Estes testes travam o contrato que a página do cadastro e o painel usam.

const SYNC = 'chave-sync-teste';
const BASE = 'https://cadastro.kartodromodebetim.com.br';
const CHAVE = 'AbCdEfGh12345678';

function r2() {
  const mem = new Map<string, string>();
  const obj = (v: string) => ({ json: async () => JSON.parse(v), text: async () => v });
  return {
    mem,
    get: vi.fn(async (k: string) => (mem.has(k) ? obj(mem.get(k)!) : null)),
    put: vi.fn(async (k: string, v: string) => { mem.set(k, String(v)); }),
    delete: vi.fn(async (k: string | string[]) => { for (const x of [k].flat()) mem.delete(x); }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({ objects: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) })),
  };
}

const daquiA = (h: number) => {
  const d = new Date(Date.now() + h * 3_600_000 - 3 * 3_600_000); // horário de Brasília sem fuso
  return d.toISOString().slice(0, 16);
};

function grupo(extra: Record<string, unknown> = {}) {
  return {
    codigo: 'G1A2B', status: 'ativa', responsavel: 'Fulano', bateria: 'Bateria 20 min', inicio: daquiA(48), modo: 'individual',
    precoCentavos: 12000, livres: 3, tokens: ['TOKENRESP123', 'TOKENAMIGO01'], responsavelToken: 'TOKENRESP123',
    painel: {
      chave: CHAVE, n: 4, total: 48000, pago: 12000, falta: 36000, pagos: 1, cadastrados: 2, prontos: 1,
      vagas: [
        { ordem: 1, nome: 'Fulano', responsavel: true, menor: false, cadastro: 'completo', falta: [], pago: true, termo: false, link: '', podeLiberar: false },
        { ordem: 2, nome: 'Amigo 1', responsavel: false, menor: false, cadastro: 'completo', falta: [], pago: false, termo: false, link: '', podeLiberar: true },
        { ordem: 3, nome: null, responsavel: false, menor: false, cadastro: 'pendente', falta: ['cpf'], pago: false, termo: false, link: '', podeLiberar: false },
      ],
    },
    ...extra,
  };
}

let env: Record<string, unknown> & { PRE: ReturnType<typeof r2> };
const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as never;
const chamar = (caminho: string, init?: RequestInit) => worker.fetch(new Request(BASE + caminho, init), env as never, ctx);
const publicar = (grupos: unknown[]) =>
  chamar('/api/sync/grupos', { method: 'PUT', headers: { 'x-sync-key': SYNC, 'content-type': 'application/json' }, body: JSON.stringify({ grupos }) });

beforeEach(() => {
  env = { PRE: r2(), SYNC_KEY: SYNC };
  const mem = new Map<string, string>();
  vi.stubGlobal('caches', { default: {
    match: async (r: Request) => (mem.has(r.url) ? new Response(mem.get(r.url)) : undefined),
    put: async (r: Request, res: Response) => { mem.set(r.url, await res.text()); },
  } });
});

describe('PUT /api/sync/grupos', () => {
  it('exige a chave de sincronização', async () => {
    const r = await chamar('/api/sync/grupos', { method: 'PUT', body: JSON.stringify({ grupos: [] }) });
    expect(r.status).toBe(401);
  });

  it('grava o resumo e descarta itens sem tokens', async () => {
    const r = await publicar([grupo(), { codigo: 'GXXXX' }]);
    expect(await r.json()).toEqual({ gravados: 1 });
    expect(JSON.parse(env.PRE.mem.get('grupos/todos.json')!)).toHaveLength(1);
  });
});

describe('GET /api/grupo?r=TOKEN', () => {
  it('qualquer token do grupo abre o resumo, sem expor tokens nem painel', async () => {
    await publicar([grupo()]);
    const r = await chamar('/api/grupo?r=TOKENAMIGO01');
    expect(r.status).toBe(200);
    const b = await r.json() as Record<string, unknown>;
    expect(b).toMatchObject({ responsavel: 'Fulano', modo: 'individual', precoCentavos: 12000, livres: 3, aCobrarCentavos: 12000 });
    expect(JSON.stringify(b)).not.toContain('TOKEN');
    expect(b).not.toHaveProperty('painel');
  });

  it('só cobra a vaga no modo "cada um paga o seu" e com vaga livre', async () => {
    await publicar([grupo({ modo: 'unico' })]);
    expect(((await (await chamar('/api/grupo?r=TOKENRESP123')).json()) as { aCobrarCentavos: number }).aCobrarCentavos).toBe(0);
    await publicar([grupo({ livres: 0 })]);
    expect(((await (await chamar('/api/grupo?r=TOKENRESP123')).json()) as { aCobrarCentavos: number }).aCobrarCentavos).toBe(0);
  });

  it('404 para token desconhecido, grupo cancelado ou bateria que já passou', async () => {
    await publicar([grupo()]);
    expect((await chamar('/api/grupo?r=NAOEXISTE999')).status).toBe(404);
    await publicar([grupo({ status: 'cancelada' })]);
    expect((await chamar('/api/grupo?r=TOKENRESP123')).status).toBe(404);
    await publicar([grupo({ inicio: daquiA(-2) })]);
    expect((await chamar('/api/grupo?r=TOKENRESP123')).status).toBe(404);
  });
});

describe('GET /api/grupo/pagamento', () => {
  it('recusa id que não é de cobrança Asaas', async () => {
    expect((await chamar('/api/grupo/pagamento?id=abc')).status).toBe(400);
  });
});

describe('painel do organizador', () => {
  it('abre só com a chave certa e sem devolver a chave', async () => {
    await publicar([grupo()]);
    expect((await chamar(`/api/grupo/painel?g=G1A2B&k=${'x'.repeat(16)}`)).status).toBe(404);
    const r = await chamar(`/api/grupo/painel?g=G1A2B&k=${CHAVE}`);
    expect(r.status).toBe(200);
    const b = await r.json() as Record<string, unknown>;
    expect(b).toMatchObject({ codigo: 'G1A2B', cadastrados: 2, linkGrupo: `https://reservas.kartodromodebetim.com.br/?r=TOKENRESP123` });
    expect(JSON.stringify(b)).not.toContain(CHAVE);
  });

  it('liberar vaga: entra na fila do R2 só quando a vaga pode ser liberada', async () => {
    await publicar([grupo()]);
    const acao = (ordem: number) => chamar('/api/grupo/painel/acao', { method: 'POST', body: JSON.stringify({ g: 'G1A2B', k: CHAVE, acao: 'liberar', ordem }) });
    expect((await acao(3)).status).toBe(409);
    expect((await acao(2)).status).toBe(202);
    expect(env.PRE.mem.has('grupos/acoes/G1A2B-2.json')).toBe(true);
    const painel = await (await chamar(`/api/grupo/painel?g=G1A2B&k=${CHAVE}`)).json() as { pendentes: number[] };
    expect(painel.pendentes).toEqual([2]);
  });

  it('não libera vaga a menos de 1 hora da bateria', async () => {
    await publicar([grupo({ inicio: daquiA(0.5) })]);
    const r = await chamar('/api/grupo/painel/acao', { method: 'POST', body: JSON.stringify({ g: 'G1A2B', k: CHAVE, acao: 'liberar', ordem: 2 }) });
    expect(r.status).toBe(409);
  });
});

describe('pagamentos de grupo avisados pelo webhook (cota da Asaas estourada, 12/11/2026)', () => {
  it('SRVKART lê e limpa os avisos em /api/sync/grupos/pagos', async () => {
    env.PRE.mem.set('grupos/pagos/pay_abc123.json', JSON.stringify({ asaasId: 'pay_abc123', externalReference: 'grupo-G1A2B3C4-52998224725', value: 145 }));
    const lista = await chamar('/api/sync/grupos/pagos', { headers: { 'x-sync-key': SYNC } });
    expect(lista.status).toBe(200);
    expect(await lista.json()).toEqual([expect.objectContaining({ asaasId: 'pay_abc123' })]);
    const limpar = await chamar('/api/sync/grupos/pagos/limpar', { method: 'POST', headers: { 'x-sync-key': SYNC }, body: JSON.stringify({ ids: ['pay_abc123', '../x'] }) });
    expect(await limpar.json()).toMatchObject({ removidos: 1 });
    expect(env.PRE.mem.has('grupos/pagos/pay_abc123.json')).toBe(false);
  });

  it('a página de pagamento vê o pago pelo aviso, sem chamar a Asaas', async () => {
    env.PRE.mem.set('grupos/pagos/pay_abc123.json', JSON.stringify({ asaasId: 'pay_abc123', billingType: 'PIX' }));
    const f = vi.spyOn(globalThis, 'fetch');
    const r = await chamar('/api/grupo/pagamento?id=pay_abc123');
    expect(await r.json()).toMatchObject({ pago: true });
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });

  it('Asaas fora do ar: o cadastro pelo link do grupo é salvo mesmo sem cobrança', async () => {
    await publicar([grupo()]);
    env.ASAAS_API_KEY = 'x';
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ errors: [{ description: 'Cota de requisições das últimas 12 horas excedida.' }] }), { status: 429 }));
    const corpo = {
      tipoDocumento: 'CPF', documento: '529.982.247-25', nome: 'Maria da Silva', email: 'maria@exemplo.com', instagram: '@maria.silva', telefone: '(31) 98888-7777',
      nascimento: '1990-05-20', peso: '62', cep: '32600000', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Betim', estado: 'MG', lgpd: true, t: Date.now() - 10_000, reserva: 'TOKENAMIGO01',
    };
    const r = await chamar('/api/pre-cadastro', { method: 'POST', body: JSON.stringify(corpo) });
    const b = await r.json() as Record<string, unknown>;
    expect(r.status).toBe(201);
    expect(b.aviso).toMatch(/Cadastro salvo/);
    expect(env.PRE.mem.has('pendentes/52998224725.json')).toBe(true);
    f.mockRestore();
  });
});

describe('endereço único: cadastro.* abre em reservas.*', () => {
  const pagina = (caminho: string, headers: Record<string, string> = {}) =>
    worker.fetch(new Request(BASE + caminho, { headers }), { ...env, ASSETS: { fetch: async () => new Response('pagina') } } as never, ctx);
  it('link do grupo, QR do balcão e painel redirecionam', async () => {
    const g = await pagina('/?r=TOKENRESP123');
    expect(g.status).toBe(302);
    expect(g.headers.get('location')).toBe('https://reservas.kartodromodebetim.com.br/?r=TOKENRESP123');
    expect((await pagina('/')).headers.get('location')).toBe('https://reservas.kartodromodebetim.com.br/cadastro');
    expect((await pagina('/painel?g=G1A2B&k=x')).headers.get('location')).toBe('https://reservas.kartodromodebetim.com.br/painel?g=G1A2B&k=x');
  });
  it('o que veio pelo site de reservas não volta (sem loop)', async () => {
    const r = await pagina('/?r=TOKENRESP123', { 'x-kib-via-reservas': '1' });
    expect(r.status).toBe(200);
  });
  it('/conta (links do app) não redireciona', async () => {
    expect((await pagina('/conta')).status).toBe(200);
  });
});

describe('check-in de quem entrou pelo link do grupo', () => {
  const PISTA = { lat: -19.92032, lng: -44.17568 };
  const ck = (corpo: Record<string, unknown>) => chamar('/api/grupo/checkin', { method: 'POST', body: JSON.stringify({ r: 'TOKENAMIGO01', cpf: '529.982.247-25', ...PISTA, precisao: 20, ...corpo }) });

  it('no kartódromo, na janela de 2 h: entra na fila do SRVKART com token e CPF', async () => {
    await publicar([grupo({ inicio: daquiA(1) })]);
    const r = await ck({});
    expect(r.status).toBe(202);
    const chave = [...env.PRE.mem.keys()].find((k) => k.startsWith('checkins/'))!;
    expect(chave).toMatch(/^checkins\/[0-9a-f-]{36}\.json$/);
    expect(JSON.parse(env.PRE.mem.get(chave)!)).toMatchObject({ tipo: 'grupo', token: 'TOKENAMIGO01', cpf: '52998224725', state: 'pending' });
  });

  it('cedo demais, longe da pista ou grupo desconhecido: recusa', async () => {
    await publicar([grupo({ inicio: daquiA(5) })]);
    expect((await ck({})).status).toBe(409);
    await publicar([grupo({ inicio: daquiA(1) })]);
    expect(await (await ck({ lat: -19.80, lng: -44.0 })).json()).toMatchObject({ erro: expect.stringMatching(/km do kartódromo/) });
    expect((await ck({ r: 'NAOEXISTE999' })).status).toBe(404);
    expect((await ck({ cpf: '123' })).status).toBe(400);
  });
});

describe('nunca boleto: Pix ou cartão da mesma cobrança', () => {
  const asaas = (pagamento: Record<string, unknown>) => {
    const chamadas: { url: string; metodo: string; corpo: unknown }[] = [];
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
      chamadas.push({ url: String(u), metodo: init?.method ?? 'GET', corpo: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify(pagamento), { status: 200 });
    });
    return { chamadas, f };
  };
  const base = { id: 'pay_abc123', status: 'PENDING', billingType: 'PIX', invoiceUrl: 'https://www.asaas.com/i/abc123', externalReference: 'grupo-12-34' };

  it('cartão: troca a forma da cobrança e abre a fatura', async () => {
    env.ASAAS_API_KEY = 'x';
    const { chamadas, f } = asaas(base);
    const r = await chamar('/api/pagar?forma=cartao&id=pay_abc123');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://www.asaas.com/i/abc123');
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({ billingType: 'CREDIT_CARD' });
    f.mockRestore();
  });

  it('Pix numa cobrança já Pix: só abre a fatura', async () => {
    env.ASAAS_API_KEY = 'x';
    const { chamadas, f } = asaas(base);
    expect((await chamar('/api/pagar?forma=pix&id=pay_abc123')).status).toBe(302);
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
    f.mockRestore();
  });

  it('cobrança que não é de grupo não é mexida', async () => {
    env.ASAAS_API_KEY = 'x';
    const { f } = asaas({ ...base, externalReference: 'outra-coisa' });
    expect((await chamar('/api/pagar?forma=cartao&id=pay_abc123')).status).toBe(404);
    f.mockRestore();
  });

  it('nenhuma cobrança do código nasce como UNDEFINED (boleto)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const arq of ['workers/pre-cadastro/src/index.ts', 'workers/pre-cadastro/src/asaas.ts', 'workers/pre-cadastro/src/reservas.ts', 'workers/pre-cadastro/src/extras.ts']) {
      expect(readFileSync(arq, 'utf8')).not.toMatch(/billingType:\s*'(UNDEFINED|BOLETO)'/);
    }
  });
});

describe('estreante pelo link do grupo paga o preço de primeira vez', () => {
  const corpo = {
    tipoDocumento: 'CPF', documento: '529.982.247-25', nome: 'Maria da Silva', email: 'maria@exemplo.com', instagram: '@maria.silva', telefone: '(31) 98888-7777',
    nascimento: '1990-05-20', peso: '62', cep: '32600000', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Betim', estado: 'MG', lgpd: true, reserva: 'TOKENAMIGO01',
  };
  const simular = (precoOps: number | 'fora') => {
    const pagamentos: { value: number; billingType: string }[] = [];
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
      const url = String(u);
      if (url.includes('/api/totem/grupo-preco')) {
        if (precoOps === 'fora') throw new Error('timeout');
        return new Response(JSON.stringify({ precoCentavos: precoOps, primeiraVez: true }), { status: 200 });
      }
      if (url.includes('/customers?')) return new Response(JSON.stringify({ data: [{ id: 'cus_1' }] }), { status: 200 });
      if (url.endsWith('/payments') && init?.method === 'POST') {
        pagamentos.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: 'pay_novo123', invoiceUrl: 'https://www.asaas.com/i/novo123' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    return { pagamentos, f };
  };
  const enviar = () => chamar('/api/pre-cadastro', { method: 'POST', body: JSON.stringify({ ...corpo, t: Date.now() - 10_000 }) });

  it('SRVKART diz que é estreante: a cobrança sai pelo preço de primeira vez, só Pix', async () => {
    await publicar([grupo({ precoCentavos: 9990 })]);
    env.ASAAS_API_KEY = 'x';
    const { pagamentos, f } = simular(8990);
    const b = await (await enviar()).json() as { pagamento?: { valorCentavos: number } };
    expect(pagamentos[0]).toMatchObject({ value: 89.9, billingType: 'PIX' });
    expect(b.pagamento?.valorCentavos).toBe(8990);
    f.mockRestore();
  });

  it('SRVKART fora do ar: cobra o preço do grupo', async () => {
    await publicar([grupo({ precoCentavos: 9990 })]);
    env.ASAAS_API_KEY = 'x';
    const { pagamentos, f } = simular('fora');
    await enviar();
    expect(pagamentos[0].value).toBe(99.9);
    f.mockRestore();
  });

  it('nunca cobra a mais que o preço do grupo', async () => {
    await publicar([grupo({ precoCentavos: 9990 })]);
    env.ASAAS_API_KEY = 'x';
    const { pagamentos, f } = simular(50000);
    await enviar();
    expect(pagamentos[0].value).toBe(99.9);
    f.mockRestore();
  });
});

describe('cupom do amigo no link do grupo', () => {
  const corpo = {
    tipoDocumento: 'CPF', documento: '529.982.247-25', nome: 'Maria da Silva', email: 'maria@exemplo.com', instagram: '@maria.silva', telefone: '(31) 98888-7777',
    nascimento: '1990-05-20', peso: '62', cep: '32600000', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Betim', estado: 'MG', lgpd: true, reserva: 'TOKENAMIGO01',
  };
  const simular = (resposta: Record<string, unknown>) => {
    const ops: unknown[] = []; const pagamentos: { value: number }[] = [];
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u, init) => {
      const url = String(u);
      if (url.includes('/api/totem/grupo-preco')) { ops.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify(resposta), { status: 200 }); }
      if (url.includes('/customers?')) return new Response(JSON.stringify({ data: [{ id: 'cus_1' }] }), { status: 200 });
      if (url.endsWith('/payments') && init?.method === 'POST') { pagamentos.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ id: 'pay_cupom123', invoiceUrl: 'https://www.asaas.com/i/cupom123' }), { status: 200 }); }
      return new Response('{}', { status: 200 });
    });
    return { ops, pagamentos, f };
  };
  const enviar = (cupom?: string) => chamar('/api/pre-cadastro', { method: 'POST', body: JSON.stringify({ ...corpo, ...(cupom ? { cupom } : {}), t: Date.now() - 10_000 }) });

  it('cupom válido: SRVKART recebe o código, a cobrança sai com desconto e o cupom vai para o SRVKART no cadastro', async () => {
    await publicar([grupo({ precoCentavos: 14500 })]);
    env.ASAAS_API_KEY = 'x';
    const { ops, pagamentos, f } = simular({ precoCentavos: 13050, primeiraVez: false, cupom: { codigo: 'AMIGO10', descontoCentavos: 1450 } });
    const b = await (await enviar(' amigo10 ')).json() as { pagamento?: { valorCentavos: number; cupom?: unknown } };
    expect(ops[0]).toMatchObject({ token: 'TOKENAMIGO01', cupom: 'AMIGO10' });
    expect(pagamentos[0].value).toBe(130.5);
    expect(b.pagamento).toMatchObject({ valorCentavos: 13050, cupom: { codigo: 'AMIGO10', descontoCentavos: 1450 } });
    expect(JSON.parse(env.PRE.mem.get('pendentes/52998224725.json')!).cobranca).toMatchObject({ valorCentavos: 13050, cupom: { codigo: 'AMIGO10' } });
    f.mockRestore();
  });

  it('cupom recusado: preço normal e o motivo aparece para a pessoa', async () => {
    await publicar([grupo({ precoCentavos: 14500 })]);
    env.ASAAS_API_KEY = 'x';
    const { pagamentos, f } = simular({ precoCentavos: 14500, primeiraVez: false, cupom: null, erroCupom: 'Voucher expirado.' });
    const b = await (await enviar('VELHO')).json() as { pagamento?: { erroCupom?: string } };
    expect(pagamentos[0].value).toBe(145);
    expect(b.pagamento?.erroCupom).toBe('Voucher expirado.');
    f.mockRestore();
  });

  it('cupom que zera a vaga: preço normal (a Asaas não cobra R$ 0), usar na recepção', async () => {
    await publicar([grupo({ precoCentavos: 14500 })]);
    env.ASAAS_API_KEY = 'x';
    const { pagamentos, f } = simular({ precoCentavos: 0, primeiraVez: false, cupom: { codigo: 'CORTESIA', descontoCentavos: 14500 } });
    const b = await (await enviar('CORTESIA')).json() as { pagamento?: { erroCupom?: string } };
    expect(pagamentos[0].value).toBe(145);
    expect(b.pagamento?.erroCupom).toMatch(/recepção/);
    f.mockRestore();
  });
});
