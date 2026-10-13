import { describe, expect, it } from 'vitest';
import { erroCadastroObrigatorio, erroPesoCliente } from '../../lib/ops/cadastro-obrigatorio';

describe('peso e e-mail obrigatórios no cadastro presencial', () => {
  it.each([undefined, null, '', '   '])('recusa e-mail vazio: %s', (email) => {
    expect(erroCadastroObrigatorio({ email, peso: '80' })).toContain('e-mail é obrigatório');
  });
  it.each(['pedro', 'p@', 'p@local', 'p @exemplo.com'])('recusa e-mail inválido: %s', (email) => {
    expect(erroCadastroObrigatorio({ email, peso: 80 })).toContain('E-mail inválido');
  });
  it.each([undefined, null, '', '   '])('recusa peso vazio: %s', (peso) => {
    expect(erroCadastroObrigatorio({ email: 'piloto@example.com', peso })).toContain('peso é obrigatório');
  });
  it.each(['abc', 'NaN', 'Infinity', 0, -1, 500])('recusa peso inválido: %s', (peso) => {
    expect(erroPesoCliente(peso)).toContain('Peso inválido');
  });
  it.each(['80', '80,5', '80.5', 38.5])('aceita cadastro completo com peso %s', (peso) => {
    expect(erroCadastroObrigatorio({ email: ' piloto@example.com ', peso, instagram: '@piloto' })).toBeNull();
  });
});
