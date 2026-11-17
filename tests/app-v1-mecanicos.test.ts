import { describe, expect, it } from 'vitest';
import { MECANICOS, mecanicoDaCasa } from '../lib/app-v1/operacao';

describe('mecânicos da casa', () => {
  it('são só Anderson, Johnny e Doidim', () => expect([...MECANICOS]).toEqual(['Anderson', 'Johnny', 'Doidim']));
  it('corrige grafias antigas e maiúsculas', () => {
    expect(mecanicoDaCasa('Jhonny')).toBe('Johnny');
    expect(mecanicoDaCasa(' johnny ')).toBe('Johnny');
    expect(mecanicoDaCasa('DOIDIM')).toBe('Doidim');
    expect(mecanicoDaCasa('anderson')).toBe('Anderson');
  });
  it('recusa quem não é mecânico da casa', () => {
    for (const n of ['Carlos', 'Eduardo', 'Pedro', 'Oficina Geral', '']) expect(mecanicoDaCasa(n)).toBeNull();
  });
});
