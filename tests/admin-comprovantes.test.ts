import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { nomeSeguro, tipoConfere, tratarComprovantes, type R2Bucket } from '../workers/admin/src/comprovantes';
import type { D1Db } from '../workers/admin/src/patrocinadores';

const OPS = 'https://ops.example.test';
const token = (exp = Date.now() + 3_600_000) => `${Buffer.from(JSON.stringify({ uid: 1, nome: 'ATENDENTE TESTE', admin: false, exp })).toString('base64url')}.assinatura`;

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('admin web: comprovantes de pagamento', () => {
  let mf: Miniflare;
  let db: D1Db;
  let bucket: R2Bucket;
  let tk = '';

  const chamar = (caminho: string, metodo = 'GET', corpo?: Uint8Array, tipo = 'application/pdf', semToken = false) => {
    const u = `https://admin.example.test/api/comprovantes/${caminho}`;
    return tratarComprovantes(
      new Request(u, { method: metodo, headers: { ...(semToken ? {} : { authorization: `Bearer ${tk}` }), ...(corpo ? { 'content-type': tipo } : {}) }, body: corpo as BodyInit | undefined }),
      { OPS_URL: OPS, KARTODROMO_ADMIN_DB: db, COMPROVANTES: bucket },
      new URL(u),
    );
  };

  beforeEach(async () => {
    mf = new Miniflare({ compatibilityDate: '2026-06-26', modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: ['KARTODROMO_ADMIN_DB'], r2Buckets: ['COMPROVANTES'] });
    const d1 = await mf.getD1Database('KARTODROMO_ADMIN_DB');
    await d1.batch(unstable_splitSqlQuery(readFileSync('migrations/d1/0013_comprovantes_pagamento.sql', 'utf8')).map((s) => d1.prepare(s)));
    db = d1 as unknown as D1Db;
    bucket = (await mf.getR2Bucket('COMPROVANTES')) as unknown as R2Bucket;
    tk = token();
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => new Response('{}', { status: new Headers(init?.headers).get('authorization') === `Bearer ${tk}` ? 200 : 401 })));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await mf.dispose();
  });

  it('anexa um PDF a um pagamento, lista e abre o arquivo', async () => {
    const r = await chamar('grupo/7/pagamento/42?nome=pix%20da%20Maria.pdf', 'POST', PDF);
    expect(r.status).toBe(201);
    const criado = (await r.json()) as { id: number; grupoId: number; pagamentoId: number; nome: string; tipo: string; tamanho: number; enviadoPor: string };
    expect(criado).toMatchObject({ grupoId: 7, pagamentoId: 42, nome: 'pix da Maria.pdf', tipo: 'application/pdf', tamanho: PDF.byteLength, enviadoPor: 'ATENDENTE TESTE' });

    const lista = (await (await chamar('grupo/7')).json()) as { id: number }[];
    expect(lista.map((l) => l.id)).toEqual([criado.id]);
    expect(await (await chamar('grupo/8')).json()).toEqual([]);

    const arq = await chamar(`arquivo/${criado.id}`);
    expect(arq.status).toBe(200);
    expect(arq.headers.get('content-type')).toBe('application/pdf');
    expect(new Uint8Array(await arq.arrayBuffer())).toEqual(PDF);
  });

  it('remove o anexo do banco e do R2', async () => {
    const { id } = (await (await chamar('grupo/7/pagamento/42', 'POST', PNG, 'image/png')).json()) as { id: number };
    const chave = (await db.prepare('SELECT chave FROM comprovantes_pagamento WHERE id = ?').bind(id).first<{ chave: string }>())!.chave;
    expect(await bucket.get(chave)).not.toBeNull();
    expect((await chamar(String(id), 'DELETE')).status).toBe(200);
    expect(await bucket.get(chave)).toBeNull();
    expect((await chamar(`arquivo/${id}`)).status).toBe(404);
  });

  it('recusa tipo não permitido, arquivo que não bate com o tipo, vazio e grande demais', async () => {
    expect((await chamar('grupo/7/pagamento/42', 'POST', PDF, 'text/html')).status).toBe(415);
    expect((await chamar('grupo/7/pagamento/42', 'POST', PNG, 'application/pdf')).status).toBe(400);
    expect((await chamar('grupo/7/pagamento/42', 'POST', new Uint8Array(0), 'application/pdf')).status).toBe(400);
    const grande = new Uint8Array(8 * 1024 * 1024 + 1);
    grande.set(PDF);
    expect((await chamar('grupo/7/pagamento/42', 'POST', grande, 'application/pdf')).status).toBe(413);
    expect(((await (await chamar('grupo/7')).json()) as unknown[]).length).toBe(0);
  });

  it('exige login válido e identificadores numéricos', async () => {
    expect((await chamar('grupo/7', 'GET', undefined, 'application/pdf', true)).status).toBe(401);
    tk = token(Date.now() - 1000);
    expect((await chamar('grupo/7')).status).toBe(401);
    tk = token();
    expect((await chamar('grupo/abc')).status).toBe(400);
    expect((await chamar('arquivo/1%20OR%201=1')).status).toBe(400);
  });

  it('avisa quando o R2 ainda não foi ligado', async () => {
    const u = 'https://admin.example.test/api/comprovantes/grupo/7';
    const r = await tratarComprovantes(new Request(u, { headers: { authorization: `Bearer ${tk}` } }), { OPS_URL: OPS, KARTODROMO_ADMIN_DB: db }, new URL(u));
    expect(r.status).toBe(503);
  });

  it('nomeSeguro e tipoConfere', () => {
    expect(nomeSeguro('C:\\fotos\\../comp\u0007.pdf')).toBe('comp.pdf');
    expect(nomeSeguro(null)).toBe('comprovante');
    expect(nomeSeguro('a'.repeat(300)).length).toBe(120);
    expect(tipoConfere('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(tipoConfere('image/webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(true);
    expect(tipoConfere('image/png', PDF)).toBe(false);
  });
});
