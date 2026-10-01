import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function checkoutSelection() {
  const source = readFileSync(resolve(process.cwd(), 'services/ops-ui/checkout-selection.js'), 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename: 'checkout-selection.js' });
  return context.KartodromoCheckout as { paraAdicionar: (disponiveis: Array<{ id: number }>, idsNoCarrinho: Set<number | string>) => Array<{ id: number }> };
}

describe('seleção rápida do checkout', () => {
  it('retorna todas as reservas disponíveis que ainda não estão no carrinho', () => {
    const paraAdicionar = checkoutSelection().paraAdicionar;
    const disponiveis = [{ id: 10 }, { id: 11 }, { id: 12 }];

    expect(paraAdicionar(disponiveis, new Set([11]))).toEqual([{ id: 10 }, { id: 12 }]);
  });

  it('retorna vazio quando todas as reservas já estão no carrinho', () => {
    const paraAdicionar = checkoutSelection().paraAdicionar;

    expect(paraAdicionar([{ id: 10 }], new Set(['10']))).toEqual([]);
  });
});
