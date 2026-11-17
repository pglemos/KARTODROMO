import jpeg from 'jpeg-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ops/db', () => ({ one: vi.fn(), query: vi.fn() }));
const { fotoEMiniatura, reduzirJpeg, MINI_MAX, FOTO_MAX } = await import('../../lib/ops/foto-app');

/** JPEG de teste: 600×600 com ruído (comprime mal, como foto de verdade). */
function jpegDeTeste(lado = 600, q = 90) {
  const data = new Uint8Array(lado * lado * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = (i * 7) % 255; data[i + 1] = (i * 13) % 255; data[i + 2] = (i * 31) % 255; data[i + 3] = 255; }
  return new Uint8Array(jpeg.encode({ data, width: lado, height: lado }, q).data);
}

describe('foto do app → banco', () => {
  it('gera miniatura de 160 px dentro do teto e mantém a foto do app', () => {
    const app = jpegDeTeste(600, 80);
    const { foto, mini } = fotoEMiniatura(app);
    const m = jpeg.decode(mini);
    expect([m.width, m.height]).toEqual([160, 160]);
    expect(mini.length).toBeLessThanOrEqual(MINI_MAX);
    expect(foto.length).toBeLessThanOrEqual(FOTO_MAX);
  });
  it('reduz foto grande demais e recusa o que não é JPEG', () => {
    const grande = jpegDeTeste(1400, 100);
    const { foto } = fotoEMiniatura(grande);
    expect(foto.length).toBeLessThanOrEqual(FOTO_MAX);
    expect(() => fotoEMiniatura(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toThrow(/JPEG/);
  });
  it('reduzir mantém a proporção', () => {
    const data = new Uint8Array(400 * 200 * 4).fill(200);
    const r = jpeg.decode(reduzirJpeg(new Uint8Array(jpeg.encode({ data, width: 400, height: 200 }, 80).data), 160, 75));
    expect([r.width, r.height]).toEqual([160, 80]);
  });
});
