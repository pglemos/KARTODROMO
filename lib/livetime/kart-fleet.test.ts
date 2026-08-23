import { describe, expect, it } from 'vitest';
import { kartCategoryFromNumber, normalizeKartPlate } from './kart-fleet';

describe('frota real do LapTime', () => {
  it('normaliza placas sem misturar 01 com 1', () => {
    expect(normalizeKartPlate('01')).toBe('01');
    expect(normalizeKartPlate('1')).toBe('01');
    expect(normalizeKartPlate(' 106 ')).toBe('106');
    expect(normalizeKartPlate('S1')).toBeNull();
    expect(normalizeKartPlate('201')).toBeNull();
  });

  it('classifica exclusivamente pela faixa da placa', () => {
    expect(kartCategoryFromNumber('01')).toBe('indoor');
    expect(kartCategoryFromNumber('99')).toBe('indoor');
    expect(kartCategoryFromNumber('100')).toBe('super');
    expect(kartCategoryFromNumber('200')).toBe('super');
  });
});
