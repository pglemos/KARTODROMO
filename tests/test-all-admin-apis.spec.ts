import { test, expect } from '@playwright/test';

const TARGET_URL = 'https://kartodromodebetim.com.br';

const endpoints = [
  '/api/admin/clientes?limit=10&offset=0',
  '/api/admin/laptime/racings?limit=10&offset=0',
  '/api/admin/laptime/bookings?limit=10&offset=0',
  '/api/admin/calxpro/corridas?limit=10&offset=0',
  '/api/admin/calxpro/receitas?limit=10&offset=0',
  '/api/admin/campeonatos/inscricoes?limit=10&offset=0',
  '/api/admin/db/clientes?limit=10&offset=0',
  '/api/admin/db/lanchonete_produtos?limit=10&offset=0',
  '/api/admin/db/reservas?limit=10&offset=0',
  '/api/admin/db/financeiro_lancamentos?limit=10&offset=0',
];

test.describe('Audit All Admin APIs for 200 OK', () => {
  for (const path of endpoints) {
    test(`GET ${path}`, async ({ request }) => {
      const url = `${TARGET_URL}${path}`;
      const response = await request.get(url, {
        headers: { 'accept': 'application/json' },
      });

      console.log(`GET ${path} -> Status: ${response.status()}`);
      expect(response.status()).toBe(200);
    });
  }
});
