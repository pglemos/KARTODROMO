import { describe, expect, it } from 'vitest';
import { corrigeDominio, corrigeEmail } from '../../lib/ops/email-dominio';

describe('corrige domínio de e-mail digitado errado', () => {
  it.each([
    ['gmal.com', 'gmail.com'], ['gmail.co', 'gmail.com'], ['gail.com', 'gmail.com'], ['gmail.con', 'gmail.com'], ['gamil.com', 'gmail.com'],
    ['gmail.com.br', 'gmail.com'], ['gmail', 'gmail.com'], ['gmail,com', 'gmail.com'], ['gmailcom', 'gmail.com'], ['gmail.com61', 'gmail.com'],
    ['!gmail.com', 'gmail.com'], ['gmail.com.', 'gmail.com'], ['hotail.com', 'hotmail.com'], ['hootmail.com', 'hotmail.com'],
    ['hotmail.co', 'hotmail.com'], ['outlok.com', 'outlook.com'], ['iclod.com', 'icloud.com'], ['yahoo.co.br', 'yahoo.com.br'], ['yhoo.com.br', 'yahoo.com.br'],
  ])('%s -> %s', (errado, certo) => expect(corrigeDominio(errado)).toBe(certo));

  it.each(['gmail.com', 'hotmail.com.br', 'outlook.com.br', 'yahoo.com', 'yahoo.com.ar', 'yahoo.com.tw', 'uai.com.br', 'vsb.com', 'ymail.com', 'live.com',
    'stellantis.com', 'cemig.com.br', 'hmail.com', 'tmail.com', 'yamail.com', '98gmail.com', '2yahoo.com.br', 'gm', 'empresa.com.br',
  ])('não mexe em %s', (d) => expect(corrigeDominio(d)).toBeNull());

  it('mantém o nome antes do @ e só troca o domínio', () => {
    expect(corrigeEmail('  Joao.Silva98@GMAL.com ')).toBe('joao.silva98@gmail.com');
    expect(corrigeEmail('maria@gmail.com')).toBe('maria@gmail.com');
    expect(corrigeEmail('sem-arroba.gmail.com')).toBe('sem-arroba.gmail.com');
    expect(corrigeEmail('a@b@gmal.com')).toBe('a@b@gmal.com');
  });
});
