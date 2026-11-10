import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { tratarPatrocinadores, vencimentos, type D1Db } from '../workers/admin/src/patrocinadores';

const OPS = 'https://ops.example.test';
const token = (admin: boolean, exp = Date.now() + 3_600_000) =>
  `${Buffer.from(JSON.stringify({ uid: 1, nome: 'TESTE CODEX', admin, exp })).toString('base64url')}.assinatura`;

describe('admin web: patrocinadores', () => {
  let mf: Miniflare;
  let db: D1Db;
  let tokenOk = '';
  let papelServidor = true;

  const chamar = (caminho: string, metodo = 'GET', corpo?: unknown, tk = tokenOk) =>
    tratarPatrocinadores(
      new Request(`https://admin.example.test/api/patro/${caminho}`, {
        method: metodo,
        headers: { authorization: `Bearer ${tk}`, ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      }),
      { OPS_URL: OPS, KARTODROMO_ADMIN_DB: db },
      new URL(`https://admin.example.test/api/patro/${caminho}`),
    );

  const jsonDe = async <T = any>(res: Response | Promise<Response>): Promise<T> => ((await (await res).json()) as T);

  beforeEach(async () => {
    mf = new Miniflare({ compatibilityDate: '2026-06-26', modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: ['KARTODROMO_ADMIN_DB'] });
    const d1 = await mf.getD1Database('KARTODROMO_ADMIN_DB');
    for (const f of ['0001_admin_schema', '0002_inventory_integrity', '0012_patrocinadores']) {
      await d1.batch(unstable_splitSqlQuery(readFileSync(`migrations/d1/${f}.sql`, 'utf8')).map((s) => d1.prepare(s)));
    }
    db = d1 as unknown as D1Db;
    tokenOk = token(true);
    papelServidor = true;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('authorization');
      if (auth !== `Bearer ${tokenOk}`) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ admin: papelServidor }), { status: 200 });
    }));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await mf.dispose();
  });

  it('recusa sem login, com sessão que o servidor da operação não reconhece e quem não é administrador', async () => {
    expect((await chamar('tudo', 'GET', undefined, '')).status).toBe(401);
    expect((await chamar('tudo', 'GET', undefined, token(true))).status).toBe(401);
    const naoAdmin = token(false);
    tokenOk = naoAdmin;
    papelServidor = false;
    expect((await chamar('tudo', 'GET', undefined, naoAdmin)).status).toBe(403);
    // quem decide é o servidor da operação, não o que vem escrito no token
    const forjado = token(true);
    tokenOk = forjado;
    expect((await chamar('tudo', 'GET', undefined, forjado)).status).toBe(403);
    expect((await chamar('tudo', 'GET', undefined, token(true, Date.now() - 1000))).status).toBe(401);
  });

  it('cadastra empresa, espaço e contrato, gera cobranças sem duplicar e dá baixa', async () => {
    const empresa = await jsonDe(chamar('empresas', 'POST', { nome: 'TESTE CODEX Marca', ativo: true }));
    const espaco = await jsonDe(chamar('espacos', 'POST', { nome: 'Outdoor 1', tipo: 'outdoor', valor_tabela: 1500, ativo: true }));
    const criado = await chamar('contratos', 'POST', {
      empresa_id: empresa.id, espaco_id: espaco.id, titulo: 'TESTE CODEX', status: 'ativo', valor: 1500, recorrencia: 'mensal',
      dia_vencimento: 10, data_inicio: '2020-01-01', data_fim: '2020-03-31',
    });
    expect(criado.status).toBe(201);
    const contrato = await jsonDe(criado);

    expect(await jsonDe(chamar(`contratos/${contrato.id}/cobrancas`, 'POST', {}))).toEqual({ geradas: 3, total: 3 });
    expect(await jsonDe(chamar(`contratos/${contrato.id}/cobrancas`, 'POST', {}))).toEqual({ geradas: 0, total: 3 });

    const dados = await jsonDe(chamar('tudo'));
    expect(dados.cobrancas).toHaveLength(3);
    expect(dados.cobrancas.every((c: { status: string }) => c.status === 'atrasado')).toBe(true);
    expect(dados.contratos[0]).toMatchObject({ empresa_nome: 'TESTE CODEX Marca', espaco_nome: 'Outdoor 1' });

    const baixa = await chamar(`cobrancas/${dados.cobrancas[0].id}`, 'PATCH', { status: 'pago', pago_em: '2020-02-10', forma_pagamento: 'Pix' });
    expect(baixa.status).toBe(200);
    expect((await jsonDe(chamar('tudo'))).cobrancas.filter((c: { status: string }) => c.status === 'pago')).toHaveLength(1);
  });

  it('não deixa dois contratos ativos no mesmo espaço e período, e rejeita campos desconhecidos', async () => {
    const e1 = await jsonDe(chamar('empresas', 'POST', { nome: 'TESTE CODEX A' }));
    const e2 = await jsonDe(chamar('empresas', 'POST', { nome: 'TESTE CODEX B' }));
    const espaco = await jsonDe(chamar('espacos', 'POST', { nome: 'Pódio', tipo: 'podio' }));
    const base = { espaco_id: espaco.id, status: 'ativo', valor: 100, recorrencia: 'mensal', dia_vencimento: 5, data_inicio: '2026-01-01', data_fim: '2026-12-31' };
    expect((await chamar('contratos', 'POST', { ...base, empresa_id: e1.id, titulo: 'A' })).status).toBe(201);
    const conflito = await chamar('contratos', 'POST', { ...base, empresa_id: e2.id, titulo: 'B', data_inicio: '2026-06-01' });
    expect(conflito.status).toBe(409);
    expect((await jsonDe(conflito)).error).toContain('TESTE CODEX A');
    expect((await chamar('contratos', 'POST', { ...base, empresa_id: e2.id, titulo: 'C', data_inicio: '2027-01-01', data_fim: null })).status).toBe(201);
    expect((await chamar('empresas', 'POST', { nome: 'X', injetado: 'DROP TABLE x' })).status).toBe(400);
  });

  it('guarda e devolve arquivo em partes e rejeita tipo inválido', async () => {
    const bytes = new Uint8Array(700_000).map((_, i) => i % 251);
    const form = new FormData();
    form.append('file', new File([bytes], 'contrato.pdf', { type: 'application/pdf' }));
    form.append('categoria', 'contrato');
    const enviado = await tratarPatrocinadores(
      new Request('https://admin.example.test/api/patro/arquivos', { method: 'POST', headers: { authorization: `Bearer ${tokenOk}` }, body: form }),
      { OPS_URL: OPS, KARTODROMO_ADMIN_DB: db }, new URL('https://admin.example.test/api/patro/arquivos'),
    );
    expect(enviado.status).toBe(201);
    const { id } = await jsonDe(enviado);
    const lido = await chamar(`arquivos/${id}`);
    expect(lido.headers.get('content-type')).toBe('application/pdf');
    expect(new Uint8Array(await lido.arrayBuffer())).toEqual(bytes);

    const ruim = new FormData();
    ruim.append('file', new File(['x'], 'a.exe', { type: 'application/x-msdownload' }));
    const r = await tratarPatrocinadores(
      new Request('https://admin.example.test/api/patro/arquivos', { method: 'POST', headers: { authorization: `Bearer ${tokenOk}` }, body: ruim }),
      { OPS_URL: OPS, KARTODROMO_ADMIN_DB: db }, new URL('https://admin.example.test/api/patro/arquivos'),
    );
    expect(r.status).toBe(415);
  });
});

describe('vencimentos de patrocínio', () => {
  it('respeita a recorrência, o dia (máx. 28) e o fim do contrato', () => {
    expect(vencimentos({ data_inicio: '2026-01-15', data_fim: '2026-04-30', recorrencia: 'mensal', dia_vencimento: 10 })).toEqual(['2026-02-10', '2026-03-10', '2026-04-10']);
    expect(vencimentos({ data_inicio: '2026-01-05', data_fim: '2026-12-31', recorrencia: 'trimestral', dia_vencimento: 31 })).toEqual(['2026-01-28', '2026-04-28', '2026-07-28', '2026-10-28']);
    expect(vencimentos({ data_inicio: '2026-03-01', recorrencia: 'unico', dia_vencimento: 15 })).toEqual(['2026-03-15']);
    expect(vencimentos({ data_inicio: '2026-01-01', recorrencia: 'mensal', dia_vencimento: 5 })).toHaveLength(13);
  });
});
