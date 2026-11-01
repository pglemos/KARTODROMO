import { describe, expect, it } from 'vitest';
import { mobileApiEndpoint } from '../../lib/mobile-api-url';

const path = '/api/mobile/v1/internal/results';

describe('destinos autorizados do Worker móvel', () => {
  it('aceita a homologação criada na conta do kartódromo', () => {
    const url = `https://kartodromo-mobile-homolog.kartodromo.workers.dev${path}`;
    expect(mobileApiEndpoint(url, path)?.href).toBe(url);
  });

  it.each([
    `http://kartodromo-mobile-homolog.kartodromo.workers.dev${path}`,
    `https://kartodromo-mobile-homolog.outra-conta.workers.dev${path}`,
    `https://kartodromo-mobile-homolog.kartodromo.workers.dev.evil.test${path}`,
    `https://kartodromo-mobile-homolog.kartodromo.workers.dev:8443${path}`,
    `https://usuario@kartodromo-mobile-homolog.kartodromo.workers.dev${path}`,
    `https://kartodromo-mobile-homolog.kartodromo.workers.dev${path}?redirect=1`,
  ])('recusa variação não autorizada: %s', (url) => {
    expect(mobileApiEndpoint(url, path)).toBeNull();
  });
});
