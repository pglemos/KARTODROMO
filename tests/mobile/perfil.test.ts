import { describe, expect, it } from 'vitest';
import { validarPerfil } from '../../workers/pre-cadastro/src/mobile/perfil';

describe('validarPerfil', () => {
  it('limpa telefone, CEP e estado', () => {
    const r = validarPerfil({ telefone: '(31) 99999-8888', cep: '32.600-000', estado: 'mg', peso: '72,5' });
    expect(r).toEqual({ ok: true, dados: { telefone: '31999998888', cep: '32600000', estado: 'MG', peso: 72.5 } });
  });
  it('recusa dados impossíveis', () => {
    expect(validarPerfil({ peso: 400 }).ok).toBe(false);
    expect(validarPerfil({ nascimento: '2999-01-01' }).ok).toBe(false);
    expect(validarPerfil({ tipoSanguineo: 'X' }).ok).toBe(false);
    expect(validarPerfil({ telefone: '123' }).ok).toBe(false);
  });
  it('ignora campos de identidade', () => {
    expect(validarPerfil({ nome: 'Outro', documento: '123' })).toEqual({ ok: false, erro: 'Nada para alterar.' });
  });
});
