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
    expect(b).toMatchObject({ codigo: 'G1A2B', cadastrados: 2, linkGrupo: `${BASE}/?r=TOKENRESP123` });
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
