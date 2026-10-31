import { describe, expect, it } from 'vitest';
import { quemSaiuDaAgenda } from '../lib/timing/agenda-saida';

const ana = { name: 'Ana', customerId: '1' };
const bia = { name: 'Bia', customerId: '2' };
const manual = { name: 'Posto à mão', customerId: '9' };

describe('quemSaiuDaAgenda', () => {
  it('tira só quem veio da agenda e não está mais nela', () => {
    const r = quemSaiuDaAgenda(['1', '2'], [ana, bia, manual], new Set(['2']));
    expect(r.competidores).toEqual([ana]);
    expect([...r.chaves]).toEqual(['1']);
  });
  it('agenda vazia: todos os puxados saem, o manual fica', () => {
    expect(quemSaiuDaAgenda(['1', '2'], [ana, bia, manual], new Set()).competidores).toEqual([ana, bia]);
  });
  it('quem o cronometrista já tirou só limpa a marca, para poder voltar', () => {
    const r = quemSaiuDaAgenda(['1'], [bia], new Set());
    expect(r.competidores).toEqual([]);
    expect(r.chaves.has('1')).toBe(true);
  });
  it('sem cliente compara pelo nome', () => {
    expect(quemSaiuDaAgenda(['joão'], [{ name: 'João ' }], new Set()).competidores).toHaveLength(1);
  });
});
