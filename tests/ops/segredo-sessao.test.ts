import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emiteToken, situacaoSegredoSessao, validaToken } from '@/lib/ops/auth';

const KEYS = ['OPS_SESSION_SECRET', 'OPS_RECEPCAO_KEY'] as const;
const saved: Record<string, string | undefined> = {};
const usuario = { uid: 1, nome: 'Teste', admin: true };

function forjar(segredo: string) {
  const payload = Buffer.from(JSON.stringify({ ...usuario, exp: Date.now() + 3_600_000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', segredo).update(payload).digest('base64url')}`;
}

describe('segredo da sessão da Recepção', () => {
  beforeEach(() => {
    for (const key of KEYS) { saved[key] = process.env[key]; delete process.env[key]; }
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('sem segredo não emite nem aceita sessão (não existe mais texto fixo)', () => {
    expect(situacaoSegredoSessao()).toBe('ausente');
    expect(() => emiteToken(usuario)).toThrow(/OPS_SESSION_SECRET/);
    expect(validaToken(forjar('sem-segredo'))).toBeNull();
  });

  it('com segredo próprio, a chave da operação não serve para fabricar sessão', () => {
    process.env.OPS_SESSION_SECRET = 'segredo-proprio-de-teste';
    process.env.OPS_RECEPCAO_KEY = 'chave-da-operacao-de-teste';
    expect(situacaoSegredoSessao()).toBe('proprio');
    expect(validaToken(emiteToken(usuario))?.uid).toBe(1);
    expect(validaToken(forjar('chave-da-operacao-de-teste'))).toBeNull();
  });

  it('só com a chave da operação continua funcionando, mas avisa que é compartilhado', () => {
    process.env.OPS_RECEPCAO_KEY = 'chave-da-operacao-de-teste';
    expect(situacaoSegredoSessao()).toBe('compartilhado');
    expect(validaToken(emiteToken(usuario))?.nome).toBe('Teste');
  });
});
