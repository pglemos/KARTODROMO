import { describe, expect, it } from 'vitest';
import { getCountUpValue } from './animate-count';

describe('getCountUpValue', () => {
  it('retorna 0 no instante inicial', () => {
    expect(getCountUpValue(0, 1000, 100)).toBe(0);
  });

  it('retorna o valor alvo quando o tempo decorrido alcança a duração', () => {
    expect(getCountUpValue(1000, 1000, 100)).toBe(100);
  });

  it('retorna o valor alvo quando o tempo decorrido passa da duração', () => {
    expect(getCountUpValue(5000, 1000, 100)).toBe(100);
  });

  it('aplica easing ease-out-cubic na metade do tempo', () => {
    // progress = 0.5 -> eased = 1 - (1-0.5)^3 = 0.875 -> round(87.5) = 88
    expect(getCountUpValue(500, 1000, 100)).toBe(88);
  });

  it('nunca retorna valor negativo quando elapsedMs é negativo', () => {
    expect(getCountUpValue(-200, 1000, 100)).toBe(0);
  });

  it('retorna o alvo imediatamente quando durationMs é zero ou negativo', () => {
    expect(getCountUpValue(0, 0, 42)).toBe(42);
    expect(getCountUpValue(0, -10, 42)).toBe(42);
  });
});
