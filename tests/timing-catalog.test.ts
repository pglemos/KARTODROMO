import { describe, expect, it } from 'vitest';
import {
  createCatalogRecord,
  emptyCatalog,
  normalizeCatalog,
  updateCatalogRecord,
  type TimingProof,
} from '../lib/timing/catalog';

describe('catálogo de cronometragem', () => {
  it('mover_grupo_mantem_provas_normalizaveis: grupoA→eventoB com prova filha; assert prova.eventId=B e normalizeCatalog aceita; evento inexistente não altera catálogo', () => {
    const catalog = emptyCatalog();
    createCatalogRecord(catalog, 'events', { name: 'Evento A' }, 'ev-a', 1000);
    createCatalogRecord(catalog, 'events', { name: 'Evento B' }, 'ev-b', 1000);
    createCatalogRecord(catalog, 'groups', { name: 'Grupo 1', eventId: 'ev-a' }, 'grp-1', 1000);
    const prv = createCatalogRecord(catalog, 'provas', { name: 'Prova 1', groupId: 'grp-1', type: 'corrida' }, 'prv-1', 1000) as TimingProof;

    // Estado inicial válido
    expect(() => normalizeCatalog(catalog)).not.toThrow();
    expect(prv.eventId).toBe('ev-a');

    // Tentar mover para evento inexistente: deve lançar erro e NÃO alterar o catálogo
    expect(() => updateCatalogRecord(catalog, 'groups', 'grp-1', { eventId: 'ev-inexistente' })).toThrow(/Selecione um evento existente/);
    expect(catalog.groups.find((g) => g.id === 'grp-1')?.eventId).toBe('ev-a');
    expect(catalog.provas.find((p) => p.id === 'prv-1')?.eventId).toBe('ev-a');

    // Mover Grupo 1 de Evento A para Evento B
    updateCatalogRecord(catalog, 'groups', 'grp-1', { eventId: 'ev-b' });

    // Prova filha deve ter eventId atualizado para ev-b
    const provaAtualizada = catalog.provas.find((p) => p.id === 'prv-1')!;
    expect(provaAtualizada.eventId).toBe('ev-b');

    // normalizeCatalog deve aceitar sem erros
    expect(() => normalizeCatalog(catalog)).not.toThrow();
  });
});
