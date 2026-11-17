import { afterEach, describe, expect, it, vi } from 'vitest';
import { avisarKartodromo } from '../../workers/pre-cadastro/src/mobile/ranking';

afterEach(() => vi.unstubAllGlobals());

describe('foto do app → kartódromo na hora', () => {
  it('PUT com a chave do app e o JPEG; DELETE quando o piloto tira', async () => {
    const f = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    const env = { MOBILE_ADMIN_TOKEN: 'k', OPS_URL: 'https://ops.x/' } as never;
    expect(await avisarKartodromo(env, '162666', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(await avisarKartodromo(env, '162666', null)).toBe(true);
    const [u1, i1] = f.mock.calls[0] as unknown as [string, RequestInit];
    const [, i2] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(u1).toBe('https://ops.x/api/app/foto/162666');
    expect(i1.method).toBe('PUT');
    expect((i1.headers as Record<string, string>)['x-mobile-admin-token']).toBe('k');
    expect(i2.method).toBe('DELETE');
  });
  it('kartódromo fora do ar não quebra o envio do app', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede'); }));
    expect(await avisarKartodromo({ MOBILE_ADMIN_TOKEN: 'k' } as never, '1', new Uint8Array([1]))).toBe(false);
  });
});
