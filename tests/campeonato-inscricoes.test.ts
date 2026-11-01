import { describe, expect, it } from 'vitest';
import { idadeEm, lerPiloto, problemaDoPiloto } from '../lib/ops/campeonato-inscricoes';

const dia = '2027-01-30';
const base = { kart: 1, nome: 'Ana Souza', cpf: '52998224725', nascimento: '2000-01-01', altura: '1,70', peso: '70' };

describe('regras do piloto das 200 Milhas', () => {
  it('aceita piloto dentro do regulamento e lê vírgula', () => {
    const p = lerPiloto(base);
    expect(p.alturaCm).toBe(170);
    expect(problemaDoPiloto(p, dia)).toBeNull();
  });
  it('idade é contada na data da prova', () => {
    expect(idadeEm('2015-01-30', dia)).toBe(12);
    expect(idadeEm('2015-01-31', dia)).toBe(11);
    expect(problemaDoPiloto(lerPiloto({ ...base, nascimento: '2015-01-31' }), dia)).toMatch(/12 anos/);
  });
  it('1,50 m e 50 kg exatos não passam (regra é "superior a")', () => {
    expect(problemaDoPiloto(lerPiloto({ ...base, altura: '1.50' }), dia)).toMatch(/altura/);
    expect(problemaDoPiloto(lerPiloto({ ...base, peso: '50' }), dia)).toMatch(/peso/);
  });
  it('recusa CPF inválido e nome sem sobrenome', () => {
    expect(problemaDoPiloto(lerPiloto({ ...base, cpf: '11111111111' }), dia)).toMatch(/CPF/);
    expect(problemaDoPiloto(lerPiloto({ ...base, nome: 'Ana' }), dia)).toMatch(/sobrenome/);
  });
});
