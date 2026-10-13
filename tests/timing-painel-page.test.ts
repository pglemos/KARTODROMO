import { describe, expect, it } from 'vitest';
import { normalizarPaginaPainel } from '../lib/timing/painel-page';

describe('pagina compartilhada do painel de LED', () => {
  it('aceita índices inteiros e rejeita valores que não representam uma página', () => {
    expect(normalizarPaginaPainel(0)).toBe(0);
    expect(normalizarPaginaPainel('2')).toBe(2);

    expect(() => normalizarPaginaPainel(-1)).toThrow('Página inválida');
    expect(() => normalizarPaginaPainel(1.5)).toThrow('Página inválida');
    expect(() => normalizarPaginaPainel('não é número')).toThrow('Página inválida');
  });
});
