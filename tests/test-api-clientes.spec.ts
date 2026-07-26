import { test, expect } from '@playwright/test';

test('Verify /api/admin/clientes on custom domain', async ({ request }) => {
  const domains = [
    'https://kartodromodebetim.com.br',
    'https://www.kartodromodebetim.com.br',
  ];

  for (const domain of domains) {
    const url = `${domain}/api/admin/clientes?limit=10&offset=0`;
    const response = await request.get(url, {
      headers: { 'accept': 'application/json' },
    });

    console.log(`GET ${url} -> Status: ${response.status()}`);
    const bodyText = await response.text();
    console.log('Response snippet:', bodyText.slice(0, 200));

    expect(response.status()).toBe(200);
  }
});
