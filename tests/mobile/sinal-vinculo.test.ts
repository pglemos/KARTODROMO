import { describe, expect, it, vi } from 'vitest';

const { SinalVinculo, esperarPedidoDeVinculo } = await import('../../workers/pre-cadastro/src/mobile/sinal-vinculo');

const novo = () => new SinalVinculo();

describe('sino do vínculo sob demanda', () => {
  it('quem espera acorda na hora em que o app toca', async () => {
    const s = novo();
    const espera = s.esperar(25_000);
    await s.tocar();
    await expect(espera).resolves.toBe(true);
  });

  it('toque sem ninguém esperando não se perde', async () => {
    const s = novo();
    await s.tocar();
    await expect(s.esperar(25_000)).resolves.toBe(true);
  });

  it('sem toque, devolve false ao fim da espera', async () => {
    vi.useFakeTimers();
    const s = novo();
    const espera = s.esperar(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(espera).resolves.toBe(false);
    vi.useRealTimers();
  });

  it('rota exige o token de administração', async () => {
    const r = await esperarPedidoDeVinculo(
      new Request('https://x/api/mobile/v1/internal/identity-wait', { headers: { 'x-mobile-admin-token': 'errado' } }),
      { MOBILE_ADMIN_TOKEN: 'certo' },
    );
    expect(r.status).toBe(401);
  });
});
