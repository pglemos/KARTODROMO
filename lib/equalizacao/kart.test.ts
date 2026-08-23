import { describe, expect, it } from 'vitest';
import {
  equalizationDeltaMs,
  equalizationState,
  kartCategoryFromPlate,
  summarizeCategory,
  targetForKart,
} from '@/lib/equalizacao/kart';

describe('classificacao de karts para equalizacao', () => {
  it('classifica placas Indoor e Super pelos limites operacionais', () => {
    expect(kartCategoryFromPlate('01')).toBe('indoor');
    expect(kartCategoryFromPlate('99')).toBe('indoor');
    expect(kartCategoryFromPlate('100')).toBe('super');
    expect(kartCategoryFromPlate('200')).toBe('super');
    expect(kartCategoryFromPlate('S1')).toBe('unknown');
  });

  it('calcula alvo e delta sem confundir placa formatada', () => {
    expect(targetForKart('106')).toBe(65_700);
    expect(targetForKart('07')).toBe(74_500);
    expect(equalizationDeltaMs(67_000, '106')).toBe(1_300);
  });

  it('separa pendencia, ajuste e equilibrio', () => {
    expect(equalizationState(null, '106')).toBe('pendente');
    expect(equalizationState(67_000, '106')).toBe('equilibrado');
    expect(equalizationState(68_000, '106')).toBe('ajustar');
    expect(equalizationState(70_000, '106')).toBe('critico');
  });

  it('resume somente as medicoes da categoria', () => {
    expect(
      summarizeCategory(
        [
          { numero: '101', media_equalizacao_ms: 65_700 },
          { numero: '102', media_equalizacao_ms: 66_700 },
          { numero: '01', media_equalizacao_ms: 74_500 },
        ],
        'super',
      ),
    ).toMatchObject({ total: 2, measured: 2, averageMs: 66_200, averageDeltaMs: 500 });
  });
});
