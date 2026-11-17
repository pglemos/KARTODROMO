import { describe, expect, it } from 'vitest';
import { produtoAntecipado } from '../../lib/ops/preco-antecipado';

const c = { produtoVenda: 4, produtosBateria: [11, 4, 67], precoProprio: [67], primeiraVez: {}, antecedenciaMin: 30, maxPilotos: 10, prazoMin: 15, diasAgenda: 500 };

describe('preço do pagamento antecipado', () => {
  it('locação normal (balcão ou antecipado) sai pelo ANTECIPADO', () => {
    expect(produtoAntecipado(11, 'BATERIA 14:40', c)).toBe(4);
    expect(produtoAntecipado(4, 'BATERIA 18:10', c)).toBe(4);
    expect(produtoAntecipado(11, 'BF RODRIGO', c)).toBe(4);
  });
  it('Happy Hour fica com o preço próprio', () => {
    expect(produtoAntecipado(67, 'BATERIA 18:45', c)).toBe(67);
  });
  it('campeonato, eventos e produtos fora da locação ficam com o produto da bateria', () => {
    expect(produtoAntecipado(11, 'BATERIA 15:50 Kojak Campeonato Lotokart', c)).toBeNull();
    expect(produtoAntecipado(11, 'Evento empresa X', c)).toBeNull();
    expect(produtoAntecipado(5, 'BATERIA FECHADA KOJAK', c)).toBeNull();
    expect(produtoAntecipado(2, 'SuperKart', c)).toBeNull();
    expect(produtoAntecipado(null, 'x', c)).toBeNull();
  });
});
