import { describe, expect, it } from 'vitest';
import { erroInstagramCliente, normalizarInstagram } from '../../lib/ops/instagram';
import { erroCadastroObrigatorio } from '../../lib/ops/cadastro-obrigatorio';
import { clienteColumns } from '../../lib/ops/db';

describe('Instagram obrigatório no cadastro', () => {
  it('normaliza o link antes de limitar o tamanho da coluna no banco', () => {
    expect(clienteColumns({ instagram: 'https://www.instagram.com/Piloto.Betim/?igsh=teste' }, false).Instagram).toBe('@piloto.betim');
  });
  it.each([undefined, null, '', ' '])('aceita Instagram vazio como opcional: %s', (instagram) => {
    expect(erroCadastroObrigatorio({ email: 'teste@example.com', peso: 80, instagram })).toBeNull();
    expect(erroInstagramCliente(instagram)).toBeNull();
  });
  it.each(['@', 'nome com espaço', 'nome@example.com', '<script>', 'x'.repeat(31), 'https://outro.com/piloto'])('recusa formato inválido: %s', (value) => {
    expect(erroInstagramCliente(value)).toContain('Instagram inválido');
  });
  it.each(['Piloto.Betim', '@Piloto.Betim', 'https://www.instagram.com/Piloto.Betim/'])('normaliza %s', (value) => {
    expect(normalizarInstagram(value)).toBe('@piloto.betim');
    expect(erroInstagramCliente(value)).toBeNull();
  });
});

describe('faixa harmonizada de peso', () => {
  it.each([10, 15, 60, 120, 250, '10', '250', '75.5'])('aceita peso válido na faixa [10, 250]: %s', (peso) => {
    expect(erroCadastroObrigatorio({ email: 'teste@example.com', peso })).toBeNull();
  });

  it.each([0, 9, 9.9, 250.1, 300, -5, 'abc'])('recusa peso fora da faixa [10, 250]: %s', (peso) => {
    expect(erroCadastroObrigatorio({ email: 'teste@example.com', peso })).toContain('Peso inválido');
  });

  it.each(['', '  ', null, undefined])('recusa peso vazio como obrigatório: %s', (peso) => {
    expect(erroCadastroObrigatorio({ email: 'teste@example.com', peso })).toContain('O peso é obrigatório');
  });
});

