import { describe, expect, it } from 'vitest';
import { nomeProprio } from '../lib/nomes';

describe('nomeProprio', () => {
  it.each([
    ['KLEIMONS VALADARES MACHADO', 'Kleimons Valadares Machado'],
    ['pedro pascoaloni matheus', 'Pedro Pascoaloni Matheus'],
    ['FLAVA MITHY RODRIGUES DA SILVA NAKAO', 'Flava Mithy Rodrigues da Silva Nakao'],
    ['joão dos santos e silva', 'João dos Santos e Silva'],
    ['ANA-CLARA D’ÁVILA', 'Ana-Clara D’Ávila'],
    ['  maria   de  souza ', 'Maria de Souza'],
    ['JOSE NETO II', 'Jose Neto II'],
    ['IAM', 'Iam'],
    ['KART 91', 'Kart 91'],
  ])('%s → %s', (a, b) => expect(nomeProprio(a)).toBe(b));

  it('respeita nome já escrito com maiúsculas e minúsculas', () => {
    expect(nomeProprio('Gabriel Ribeiro')).toBe('Gabriel Ribeiro');
    expect(nomeProprio('McLaren da Costa')).toBe('McLaren da Costa');
  });
  it('vazio continua vazio', () => expect(nomeProprio('')).toBe(''));
});
