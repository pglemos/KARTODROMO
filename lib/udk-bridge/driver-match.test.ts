import { describe, expect, it } from 'vitest';
import { DriverMatchIndex, nameSimilarity, normalizeDriverName } from '@/lib/udk-bridge/driver-match';

describe('normalizeDriverName', () => {
  it('remove acentos, pontuação e normaliza caixa/espacos', () => {
    expect(normalizeDriverName('  João  da-Silva, Jr. ')).toBe('joao da silva jr');
  });

  it('aceita nomes com numerais', () => {
    expect(normalizeDriverName('Piloto 2 - Equipe A')).toBe('piloto 2 equipe a');
  });
});

describe('nameSimilarity', () => {
  it('retorna 1 para nomes idênticos (com acentos diferentes)', () => {
    expect(nameSimilarity('João', 'JOAO')).toBe(1);
  });

  it('dá score alto quando um nome está contido no outro', () => {
    const score = nameSimilarity('PEDRO GUILHERME', 'Pedro Guilherme Lemos Teixeira');
    expect(score).toBeGreaterThan(0.8);
  });

  it('dá score baixo para nomes distintos', () => {
    const score = nameSimilarity('WALISON SOUZA', 'Bernardo Thadeu');
    expect(score).toBeLessThan(0.3);
  });
});

describe('DriverMatchIndex', () => {
  const drivers = [
    { id: 'd-70', number: 70, name: 'Pedro Henrique' },
    { id: 'd-56', number: 56, name: 'Arthur Mendes' },
    { id: 'd-num', number: null, name: 'Lucas Rabelo' },
    { id: 'd-arq', number: 7, name: 'Walison Souza (arquivado)' },
  ];

  const index = new DriverMatchIndex(drivers);

  it('resolve primeiro por kart', () => {
    const match = index.resolve(56, 'ARTHUR MENDES');
    expect(match).toEqual({ id: 'd-56', via: 'kart', score: 1 });
  });

  it('resolve por nome exato quando não há kart', () => {
    const match = index.resolve(null, 'Lucas Rabelo');
    expect(match).toEqual({ id: 'd-num', via: 'name', score: 1 });
  });

  it('resolve por similaridade quando o nome LapTime é subconjunto do UDK', () => {
    const match = index.resolve(null, 'PEDRO', 0.8);
    expect(match?.via).toBe('name');
    expect(match?.id).toBe('d-70');
    expect(match?.score).toBeGreaterThanOrEqual(0.8);
  });

  it('não resolve abaixo do score mínimo', () => {
    const match = index.resolve(null, 'Zé Ninguém', 0.9);
    expect(match).toEqual({ id: null, via: 'none', score: 0 });
  });

  it('ignora pilotos sem nome e sem kart', () => {
    const empty = new DriverMatchIndex([{ id: 'd-x', number: null, name: null }]);
    expect(empty.resolve(null, 'Qualquer Nome')).toEqual({ id: null, via: 'none', score: 0 });
  });

  it('prefere o nome mais curto em empate de score', () => {
    const tie = new DriverMatchIndex([
      { id: 'd-curto', number: null, name: 'Pedro Henrique' },
      { id: 'd-longo', number: null, name: 'Pedro Henrique Souza Lima' },
    ]);
    const match = tie.resolve(null, 'PEDRO HENRIQUE', 0.8);
    expect(match?.id).toBe('d-curto');
  });

  it('prefere o candidato mais específico (mais tokens compartilhados)', () => {
    const index = new DriverMatchIndex([
      { id: 'd-generico', number: null, name: 'Bernardo' },
      { id: 'd-especifico', number: null, name: 'Bernardo Thadeu' },
    ]);
    const match = index.resolve(null, 'BERNARDO THADEU BAYA ANDRADE - I', 0.8);
    expect(match?.id).toBe('d-especifico');
  });
});