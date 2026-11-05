import { describe, expect, it } from 'vitest';
import { preencherPosicoes, slugTracado as slugWorker } from '../../workers/pre-cadastro/src/mobile/ranking';
import { slugTracado as slugServidor } from '../../lib/ops/pilotos';
import { mascararEmail } from '../../workers/pre-cadastro/src/mobile/auth';

function dbCom(linhas: { chave: string; de: number | null; pos: number | null }[]) {
  const chamadas: unknown[][] = [];
  const db = {
    prepare: () => ({
      bind: (...args: unknown[]) => {
        chamadas.push(args);
        const pedidas = new Set(args.slice(1) as string[]);
        return { all: async () => ({ results: linhas.filter((l) => pedidas.has(l.chave)) }) };
      },
    }),
  } as unknown as D1Database;
  return { db, chamadas };
}

describe('posições do piloto fora da ficha', () => {
  it('servidor e Worker geram a mesma chave de traçado', () => {
    for (const nome of ['Traçado 1 · Super Kart', 'Circuito Noturno', 'PISTA  São João!!']) {
      expect(slugWorker(nome)).toBe(slugServidor(nome));
    }
    expect(slugWorker('Traçado 1 · Super Kart')).toBe('tracado-1-super-kart');
  });

  it('preenche posição e total por período; fora do ranking do período fica null', async () => {
    const { db, chamadas } = dbCom([
      { chave: 'posicoes:semana:circuito-a', de: 40, pos: 3 },
      { chave: 'posicoes:mes:circuito-a', de: 120, pos: null },
      { chave: 'posicoes:geral:circuito-a', de: 812, pos: 57 },
    ]);
    const r = await preencherPosicoes(db, '42', { nome: 'Maria', tracados: [{ nome: 'Circuito A', ms: 41_000, semana: { pos: 9, de: 9 } }] });
    expect(chamadas[0][0]).toBe('42');
    expect((r.tracados as Record<string, unknown>[])[0]).toMatchObject({
      nome: 'Circuito A', semana: { pos: 3, de: 40 }, mes: null, geral: { pos: 57, de: 812 },
    });
  });

  it('sem documento de posição ainda, mantém o que a ficha tinha', async () => {
    const { db } = dbCom([]);
    const r = await preencherPosicoes(db, '42', { tracados: [{ nome: 'Circuito A', semana: { pos: 9, de: 9 } }] });
    expect((r.tracados as Record<string, unknown>[])[0].semana).toEqual({ pos: 9, de: 9 });
  });
});

describe('esqueci meu e-mail', () => {
  it('mostra só o começo do usuário e o domínio', () => {
    expect(mascararEmail('Pedro.Silva@Gmail.com')).toBe('pe•••@gmail.com');
    expect(mascararEmail('a@b.com')).toBe('a•••@b.com');
    expect(mascararEmail('invalido')).toBe('•••');
  });
});
