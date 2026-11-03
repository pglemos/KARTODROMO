import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { NextRequest } from 'next/server';
import { unstable_splitSqlQuery } from 'wrangler';
import { handleAdminD1, type AdminD1Database } from './admin-d1';

const actor = 'admin@example.com';
const request = (path: string, method = 'GET', body?: unknown) =>
  new NextRequest(`https://example.com/api/admin/db/${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('admin D1 API', () => {
  let miniflare: Miniflare;
  let db: AdminD1Database;

  beforeEach(async () => {
    miniflare = new Miniflare({
      compatibilityDate: '2026-06-26',
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: ['KARTODROMO_ADMIN_DB'],
    });
    const database = await miniflare.getD1Database('KARTODROMO_ADMIN_DB');
    for (const migration of ['migrations/d1/0001_admin_schema.sql', 'migrations/d1/0002_inventory_integrity.sql']) {
      const statements = unstable_splitSqlQuery(readFileSync(migration, 'utf8'));
      await database.batch(statements.map((statement) => database.prepare(statement)));
    }
    db = database as unknown as AdminD1Database;
  });

  afterEach(async () => {
    await miniflare.dispose();
  });

  it('supports authenticated-module CRUD, filters and audit records', async () => {
    const created = await handleAdminD1(
      request('lanchonete_produtos', 'POST', {
        nome: 'Água mineral',
        sku: 'AGUA-500',
        categoria: 'Bebidas',
        preco: 5,
        ativo: true,
      }),
      ['lanchonete_produtos'],
      db,
      actor,
    );
    expect(created.status).toBe(201);
    const product = (await created.json()) as { id: string; ativo: boolean };
    expect(product.id).toBeTruthy();
    expect(product.ativo).toBe(true);

    const updated = await handleAdminD1(
      request(`lanchonete_produtos/${product.id}`, 'PATCH', { preco: 6 }),
      ['lanchonete_produtos', product.id],
      db,
      actor,
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()) as { preco: number }).toMatchObject({ preco: 6 });

    const listed = await handleAdminD1(
      request('lanchonete_produtos?q=Água&limit=10'),
      ['lanchonete_produtos'],
      db,
      actor,
    );
    expect(listed.headers.get('x-total-count')).toBe('1');
    expect(await listed.json()).toHaveLength(1);

    const audit = await handleAdminD1(request('audit_log'), ['audit_log'], db, actor);
    expect((await audit.json()) as unknown[]).toHaveLength(2);
  });

  it('registers a sale atomically and rejects insufficient inventory', async () => {
    const productResponse = await handleAdminD1(
      request('lanchonete_produtos', 'POST', {
        nome: 'Refrigerante', sku: 'REFRI-01', categoria: 'Bebidas', preco: 8, ativo: true,
      }),
      ['lanchonete_produtos'], db, actor,
    );
    const product = (await productResponse.json()) as { id: string };

    const stock = await handleAdminD1(
      request('lanchonete_estoque/upsert', 'PUT', { produto_id: product.id, quantidade: 2, min_alerta: 1 }),
      ['lanchonete_estoque', 'upsert'], db, actor,
    );
    expect(stock.status).toBe(200);

    const sale = await handleAdminD1(
      request('registrar_venda', 'POST', { pagamento: 'pix', itens: [{ produto_id: product.id, quantidade: 1 }] }),
      ['registrar_venda'], db, actor,
    );
    expect(sale.status).toBe(200);
    expect((await sale.json()) as { total: number }).toMatchObject({ total: 8 });

    const rejected = await handleAdminD1(
      request('registrar_venda', 'POST', { pagamento: 'pix', itens: [{ produto_id: product.id, quantidade: 2 }] }),
      ['registrar_venda'], db, actor,
    );
    expect(rejected.status).toBe(422);
    expect((await rejected.json()) as { error: string }).toMatchObject({ error: expect.stringContaining('estoque_insuficiente') });

    const inventory = await handleAdminD1(request('lanchonete_estoque'), ['lanchonete_estoque'], db, actor);
    expect((await inventory.json()) as Array<{ quantidade: number }>).toMatchObject([{ quantidade: 1 }]);
    const sales = await handleAdminD1(request('lanchonete_vendas'), ['lanchonete_vendas'], db, actor);
    expect(await sales.json()).toHaveLength(1);
  });

  it('rejects unknown resources and fields instead of interpolating them into SQL', async () => {
    const resource = await handleAdminD1(request('sqlite_master'), ['sqlite_master'], db, actor);
    expect(resource.status).toBe(404);

    const field = await handleAdminD1(
      request('campeonatos', 'POST', { nome: 'KAC', status: 'ativo', injected: 'DROP TABLE campeonatos' }),
      ['campeonatos'], db, actor,
    );
    expect(field.status).toBe(400);
    expect(await field.json()).toEqual({ error: 'invalid_field:injected' });
  });
});
