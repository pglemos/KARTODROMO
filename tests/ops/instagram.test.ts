import { describe, expect, it } from 'vitest';
import { erroInstagramCliente, normalizarInstagram } from '../../lib/ops/instagram';
import { erroCadastroObrigatorio } from '../../lib/ops/cadastro-obrigatorio';
import { clienteColumns } from '../../lib/ops/db';

describe('Instagram obrigatório no cadastro', () => {
  it('normaliza o link antes de limitar o tamanho da coluna no banco', () => {
    expect(clienteColumns({ instagram: 'https://www.instagram.com/Piloto.Betim/?igsh=teste' }, false).Instagram).toBe('@piloto.betim');
  });
  it.each([undefined, null, '', ' '])('recusa Instagram vazio: %s', (instagram) => {
    expect(erroCadastroObrigatorio({ email: 'teste@example.com', peso: 80, instagram })).toContain('Instagram é obrigatório');
  });
  it.each(['@', 'nome com espaço', 'nome@example.com', '<script>', 'x'.repeat(31), 'https://outro.com/piloto'])('recusa formato inválido: %s', (value) => {
    expect(erroInstagramCliente(value)).toContain('Instagram inválido');
  });
  it.each(['Piloto.Betim', '@Piloto.Betim', 'https://www.instagram.com/Piloto.Betim/'])('normaliza %s', (value) => {
    expect(normalizarInstagram(value)).toBe('@piloto.betim');
    expect(erroInstagramCliente(value)).toBeNull();
  });
});
