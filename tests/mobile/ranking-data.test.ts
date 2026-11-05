import { describe, expect, it } from 'vitest';
import { categoriaDoKart, normalizarTracado, montarRanking } from '../../workers/pre-cadastro/src/mobile/ranking-data';

describe('ranking completo por dia, categoria e traçado', () => {
  it.each([['0', 'Indoor'], ['99', 'Indoor'], ['100', 'Super Kart'], ['199', 'Super Kart'], ['200', null], ['', null]])('classifica kart %s pela numeração', (kart, expected) => {
    expect(categoriaDoKart(kart)).toBe(expected);
  });
  it('separa categoria do traçado sem apagar chicane ou sentido', () => {
    expect(normalizarTracado('Traçado 1 Normal · Super Kart')).toBe('Traçado 1');
    expect(normalizarTracado('Traçado 11 Invertido Chicane · Super Kart')).toBe('Traçado 11 Invertido Chicane');
  });
  const linhas = [
    { id: '1', nome: 'TESTE CODEX A', kart: '99', categoria: 'Super Kart', tracado: 'Traçado 1', dia: '2026-10-24', ms: 70000 },
    { id: '1', nome: 'TESTE CODEX A', kart: '99', categoria: 'Super Kart', tracado: 'Traçado 1', dia: '2026-10-27', ms: 75000 },
    { id: '2', nome: 'TESTE CODEX B', kart: '100', categoria: 'Indoor', tracado: 'Traçado 1 · Super Kart', dia: '2026-10-27', ms: 65000 },
  ];
  it('aplica o dia antes de escolher a melhor volta de cada piloto', () => {
    const r = montarRanking(linhas, new URL('https://example.com?dia=2026-10-27&categoria=Indoor'));
    expect(r.linhas).toMatchObject([{ id: '1', ms: 75000, categoria: 'Indoor', pos: 1 }]);
    expect(r.dias).toEqual(['2026-10-27', '2026-10-24']);
  });
  it('une o traçado e usa o número do kart mesmo com categoria antiga incorreta', () => {
    const r = montarRanking(linhas, new URL('https://example.com?categoria=Super%20Kart'));
    expect(r.tracados).toEqual([{ nome: 'Traçado 1', pilotos: 1 }]);
    expect(r.linhas).toMatchObject([{ id: '2', kart: '100', pos: 1 }]);
  });
  it('descarta no Traçado 1 volta abaixo de 1:10 no Indoor e de 1:04 no Super Kart (outro traçado ou corte)', () => {
    const cortes = [
      { id: '3', nome: 'TESTE CODEX C', kart: '55', tracado: 'Traçado 1', dia: '2026-10-27', ms: 60311 },
      { id: '4', nome: 'TESTE CODEX D', kart: '107', tracado: 'Traçado 1', dia: '2026-10-27', ms: 61004 },
      { id: '5', nome: 'TESTE CODEX E', kart: '', categoria: 'cat-indoor', tracado: 'Traçado 1', dia: '2026-10-27', ms: 69999 },
      { id: '6', nome: 'TESTE CODEX F', kart: '', tracado: 'Traçado 1 · Super Kart', dia: '2026-10-27', ms: 63999 },
      { id: '7', nome: 'TESTE CODEX G', kart: '12', tracado: 'Traçado 2', dia: '2026-10-27', ms: 50000 },
    ];
    const todas = [...linhas, ...cortes];
    expect(montarRanking(todas, new URL('https://example.com?categoria=Indoor&tracado=Tra%C3%A7ado%201')).linhas.map((l) => l.id)).toEqual(['1']);
    expect(montarRanking(todas, new URL('https://example.com?categoria=Super%20Kart&tracado=Tra%C3%A7ado%201')).linhas.map((l) => l.id)).toEqual(['2']);
    expect(montarRanking(todas, new URL('https://example.com?categoria=Indoor&tracado=Tra%C3%A7ado%202')).linhas.map((l) => l.id)).toEqual(['7']);
  });
});
