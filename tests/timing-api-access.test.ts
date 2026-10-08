import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  corsHeaders,
  isOrigemPermitida,
  sanitizarCompetidoresPublicos,
  validarChaveTiming,
} from '../lib/timing/api-access';

function fakeReq(headers: Record<string, string | string[] | undefined> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe('Tarefa 6 [F01, F05]: Controle de acesso e segurança da API de cronometragem', () => {
  const originalKey = process.env.TIMING_API_KEY;

  beforeEach(() => {
    delete process.env.TIMING_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.TIMING_API_KEY = originalKey;
    } else {
      delete process.env.TIMING_API_KEY;
    }
  });

  describe('validarChaveTiming', () => {
    it('recusa acesso se TIMING_API_KEY não estiver configurada no servidor (chave vazia não habilita acesso irrestrito)', () => {
      delete process.env.TIMING_API_KEY;
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': 'qualquer-coisa' }))).toBe(false);

      process.env.TIMING_API_KEY = '   ';
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': '' }))).toBe(false);
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': '   ' }))).toBe(false);
    });

    it('recusa requisição sem o header x-timing-key ou com header vazio', () => {
      process.env.TIMING_API_KEY = 'chave-secreta-456';
      expect(validarChaveTiming(fakeReq({}))).toBe(false);
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': '' }))).toBe(false);
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': '   ' }))).toBe(false);
    });

    it('recusa chave incorreta ou com tamanho diferente em tempo constante', () => {
      process.env.TIMING_API_KEY = 'chave-secreta-456';
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': 'chave-errada' }))).toBe(false);
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': 'chave-secreta-457' }))).toBe(false);
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': 'chave-secreta-4567' }))).toBe(false);
    });

    it('aceita chave idêntica', () => {
      process.env.TIMING_API_KEY = 'chave-secreta-456';
      expect(validarChaveTiming(fakeReq({ 'x-timing-key': 'chave-secreta-456' }))).toBe(true);
    });
  });

  describe('cors_nao_autoriza_origem_arbitraria', () => {
    it('recusa origens arbitrárias e externas na verificação e nos headers CORS', () => {
      const origensInvasoras = [
        'http://site-atacante.com',
        'https://phishing.xyz',
        'http://192.168.20.13.evil.com',
        'http://localhost.evil.com',
      ];

      for (const origem of origensInvasoras) {
        expect(isOrigemPermitida(origem)).toBe(false);
        const headers = corsHeaders(origem);
        expect(headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('permite origens locais legítimas (localhost e IP de rede local)', () => {
      const origensLegitimas = [
        'http://localhost:3000',
        'http://127.0.0.1:4050',
        'http://192.168.20.249:4050',
        'http://10.0.0.5:8080',
      ];

      for (const origem of origensLegitimas) {
        expect(isOrigemPermitida(origem)).toBe(true);
        const headers = corsHeaders(origem);
        expect(headers['access-control-allow-origin']).toBe(origem);
        expect(headers['access-control-allow-headers']).toContain('x-timing-key');
      }
    });
  });

  describe('sanitizarCompetidoresPublicos', () => {
    it('remove dados privados (email, telefone, peso, cpf) dos detalhes do competidor', () => {
      const competidores = [
        {
          kart: '4',
          name: 'Piloto Teste',
          detalhes: {
            peso: 75,
            email: 'piloto@teste.com',
            telefone: '31999998888',
            cpf: '12345678901',
            patrocinador: 'Kartodromo',
          },
        },
        {
          kart: '5',
          name: 'Piloto Sem Detalhes',
        },
      ];

      const limpos = sanitizarCompetidoresPublicos(competidores);
      expect(limpos[0].name).toBe('Piloto Teste');
      expect((limpos[0].detalhes as any).patrocinador).toBe('Kartodromo');
      expect((limpos[0].detalhes as any).peso).toBeUndefined();
      expect((limpos[0].detalhes as any).email).toBeUndefined();
      expect((limpos[0].detalhes as any).telefone).toBeUndefined();
      expect((limpos[0].detalhes as any).cpf).toBeUndefined();
    });
  });
});
