import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { createChampionshipRegistration, listChampionshipRegistrations, updateChampionshipRegistration } from './championship-registrations-d1';
import { normalizeChampionshipRegistration } from './championship-registrations';
import type { AdminD1Database } from './admin-d1';

describe('championship registrations on D1', () => {
  let miniflare: Miniflare;
  let db: AdminD1Database;

  beforeEach(async () => {
    miniflare = new Miniflare({
      compatibilityDate: '2026-07-02',
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: ['KARTODROMO_ADMIN_DB'],
    });
    const database = await miniflare.getD1Database('KARTODROMO_ADMIN_DB');
    for (const migration of ['migrations/d1/0001_admin_schema.sql', 'migrations/d1/0002_inventory_integrity.sql', 'migrations/d1/0005_championship_registrations.sql']) {
      const statements = unstable_splitSqlQuery(readFileSync(migration, 'utf8'));
      await database.batch(statements.map((statement) => database.prepare(statement)));
    }
    db = database as unknown as AdminD1Database;
  });

  afterEach(async () => {
    await miniflare.dispose();
  });

  it('creates, filters and updates a registration without an external service', async () => {
    const payload = normalizeChampionshipRegistration({
      evento: '500 Milhas 2026',
      modalidade: 'individual',
      fullName: 'Piloto D1',
      whatsapp: '(31) 99999-0000',
      email: 'piloto@example.com',
      age: 32,
      weight: 82,
    });

    const created = await createChampionshipRegistration(db, payload, 'KDB-260822-A1B2C3');
    expect(created).toMatchObject({
      protocol: 'KDB-260822-A1B2C3',
      evento: '500 Milhas 2026',
      status: 'pendente',
      nome_completo: 'Piloto D1',
      pilotos: [],
    });

    const listed = await listChampionshipRegistrations(db, {
      evento: '500 Milhas 2026',
      q: 'Piloto D1',
      status: 'pendente',
      limit: 10,
      offset: 0,
    });
    expect(listed.total).toBe(1);
    expect(listed.rows).toHaveLength(1);

    const updated = await updateChampionshipRegistration(db, created.id, {
      status: 'confirmada',
      admin_notes: 'Pagamento conferido',
      reviewed_at: '2026-08-22T17:00:00.000Z',
    });
    expect(updated).toMatchObject({ status: 'confirmada', admin_notes: 'Pagamento conferido' });
  });
});
