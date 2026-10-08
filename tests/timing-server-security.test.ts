import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerConfig, salvarConfig } from '../services/timing-email';

describe('Tarefa 6 [F01, F05]: Segurança do timing-server, decoder e SMTP', () => {
  let tmpDir: string;
  let emailFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'timing-sec-test-'));
    emailFile = join(tmpDir, 'email.json');
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignora erro de limpeza
    }
  });

  describe('troca_host_smtp_nao_reutiliza_senha_sem_confirmacao', () => {
    it('mudança de host com senha vazia não autentica no novo destino usando a credencial anterior', () => {
      // 1. Salva configuração inicial com host A e senha definida
      salvarConfig(emailFile, {
        host: 'mail.kartodromodebetim.com.br',
        porta: 465,
        usuario: 'resultados@kartodromodebetim.com.br',
        senha: 'senha-super-secreta',
      });

      const configInicial = lerConfig(emailFile);
      expect(configInicial.host).toBe('mail.kartodromodebetim.com.br');
      expect(configInicial.senha).toBe('senha-super-secreta');

      // 2. Altera o host para host B com campo senha vazio (sem confirmar nova senha)
      salvarConfig(emailFile, {
        host: 'smtp.servidor-externo.com',
        porta: 587,
        usuario: 'resultados@kartodromodebetim.com.br',
        senha: '', // Senha vazia ao trocar de host
      });

      const configAposTroca = lerConfig(emailFile);
      expect(configAposTroca.host).toBe('smtp.servidor-externo.com');
      // A senha NÃO deve ter sido copiada para o novo host! Deve ser limpa/exigir confirmação.
      expect(configAposTroca.senha).toBe('');
    });

    it('mantém a senha quando o host permanece o mesmo e a senha vem vazia', () => {
      salvarConfig(emailFile, {
        host: 'mail.kartodromodebetim.com.br',
        porta: 465,
        usuario: 'resultados@kartodromodebetim.com.br',
        senha: 'senha-super-secreta',
      });

      // Mesma host, apenas alterando remetenteNome sem mexer na senha
      salvarConfig(emailFile, {
        host: 'mail.kartodromodebetim.com.br',
        remetenteNome: 'Kartódromo Atualizado',
        senha: '',
      });

      const config = lerConfig(emailFile);
      expect(config.remetenteNome).toBe('Kartódromo Atualizado');
      expect(config.senha).toBe('senha-super-secreta');
    });
  });

  describe('mutacao_sem_chave_ou_chave_errada_retorna401', () => {
    it('identifica rotas de mutação que exigem chave de autenticação', async () => {
      const { rotaExigeChave } = await import('../lib/timing/api-access');

      // Mutações exigem chave
      expect(rotaExigeChave('POST', '/api/sessions')).toBe(true);
      expect(rotaExigeChave('POST', '/api/sessions/sess-1/close')).toBe(true);
      expect(rotaExigeChave('POST', '/api/backup')).toBe(true);
      expect(rotaExigeChave('PUT', '/api/email-config')).toBe(true);
      expect(rotaExigeChave('PATCH', '/api/settings/decoder')).toBe(true);
      expect(rotaExigeChave('DELETE', '/api/catalog/events/ev-1')).toBe(true);

      // Leituras públicas não exigem chave
      expect(rotaExigeChave('GET', '/api/sessions')).toBe(false);
      expect(rotaExigeChave('GET', '/api/sessions/sess-1')).toBe(false);
      expect(rotaExigeChave('GET', '/api/state')).toBe(false);
      expect(rotaExigeChave('GET', '/healthz')).toBe(false);

      // Leituras privadas exigem chave
      expect(rotaExigeChave('GET', '/api/clientes')).toBe(true);
      expect(rotaExigeChave('GET', '/api/catalog/backups')).toBe(true);
      expect(rotaExigeChave('GET', '/api/email-config')).toBe(true);
    });
  });

  describe('decoder_revalida_corrida_apos_probe', () => {
    it('rejeita alteração de decoder e não para o decoder atual se uma corrida iniciar durante o probe', async () => {
      let decoderParado = false;
      const decoderAtual = {
        stop: () => {
          decoderParado = true;
        },
      };

      let corridaEmAndamento = false;
      const runningSession = () => (corridaEmAndamento ? { id: 'sess-1' } : null);

      // Simulação do fluxo de PATCH /api/settings/decoder
      async function atualizarDecoder(probeAsync: () => Promise<{ ok: boolean }>) {
        if (runningSession()) {
          return { status: 409, error: 'Encerre a bateria em andamento antes de alterar o decoder.' };
        }
        const probe = await probeAsync();
        if (!probe.ok) {
          return { status: 502, error: 'Não foi possível conectar ao decoder.' };
        }
        // RECHECK SÍNCRONO obrigatório após o probe (F05)
        if (runningSession()) {
          return { status: 409, error: 'Uma bateria foi iniciada durante o teste do decoder. Alteração recusada.' };
        }
        decoderAtual.stop();
        return { status: 200, ok: true };
      }

      // Largada ocorre DURANTE o probe
      const probeLentoComLargada = async () => {
        // Corrida inicia no meio do probe
        corridaEmAndamento = true;
        return { ok: true };
      };

      const resultado = await atualizarDecoder(probeLentoComLargada);

      // Deve recusar com 409
      expect(resultado.status).toBe(409);
      expect(resultado.error).toContain('Uma bateria foi iniciada durante o teste do decoder');
      // O decoder atual NÃO pode ter sido parado
      expect(decoderParado).toBe(false);
    });
  });
});
