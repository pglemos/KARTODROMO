import { describe, expect, it } from 'vitest';
import { chaveDocumento, cpfValido, dataValida, validar } from '../workers/pre-cadastro/src/validar';

const HOJE = new Date('2026-09-27T12:00:00Z');
const base = {
  tipoDocumento: 'CPF', documento: '529.982.247-25', nome: 'Maria  da Silva', email: 'Maria@Email.com', telefone: '(31) 98888-7777',
  nascimento: '1990-05-20', peso: '72,5', cep: '32600-000', endereco: 'Rua A', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Betim', estado: 'mg', lgpd: true,
};

describe('pré-cadastro online', () => {
  it('aceita um cadastro completo e normaliza os campos', () => {
    const r = validar(base, HOJE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados).toMatchObject({ nome: 'Maria da Silva', email: 'maria@email.com', peso: '72.5', cep: '32600000', estado: 'MG', menores: [] });
  });

  it('recusa como o totem: CPF inválido, nome sem sobrenome, celular sem DDD, nascimento, termo', () => {
    expect(validar({ ...base, documento: '111.111.111-11' }, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/CPF inválido/) });
    expect(validar({ ...base, nome: 'Maria' }, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/nome completo/) });
    expect(validar({ ...base, telefone: '98888-7777' }, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/DDD/) });
    expect(validar({ ...base, nascimento: '2027-01-01' }, HOJE)).toMatchObject({ ok: false });
    expect(validar({ ...base, lgpd: false }, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/Termo/) });
    expect(validar({ ...base, email: 'sem-arroba' }, HOJE)).toMatchObject({ ok: false, erro: expect.stringMatching(/E-mail/) });
  });

  it('RG e passaporte viram a mesma chave que o totem procura', () => {
    expect(chaveDocumento('RG', 'MG-12.345.678')).toBe('12345678');
    expect(chaveDocumento('CPF', '529.982.247-25')).toBe('52998224725');
    expect(chaveDocumento('Passaporte', 'fx-123456')).toBe('123456');
    expect(chaveDocumento('Passaporte', 'ABCDEF')).toBe('ABCDEF');
    expect(validar({ ...base, tipoDocumento: 'RG', documento: 'MG-12.345.678' }, HOJE).ok).toBe(true);
  });

  it('menores: nome completo e nascimento obrigatórios, linhas vazias ignoradas', () => {
    const ok = validar({ ...base, menores: [{ nome: 'João da Silva', nascimento: '2015-03-02', documento: '' }, { nome: '', nascimento: '' }] }, HOJE);
    expect(ok.ok && ok.dados.menores).toEqual([{ nome: 'João da Silva', nascimento: '2015-03-02', documento: '' }]);
    expect(validar({ ...base, menores: [{ nome: 'João', nascimento: '2015-03-02' }] }, HOJE).ok).toBe(false);
  });

  it('datas e CPF', () => {
    expect(dataValida('2026-02-30', HOJE)).toBe(false);
    expect(dataValida('1920-01-01', HOJE)).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });
});
