import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_PADRAO, configPublica, enviarResultado, lerConfig, sanitizarNomeDestinatario, semEmailAosPilotos, validarEmailDestinatario, salvarConfig } from '../services/timing-email';
import type { Session } from '../lib/timing/race-engine';
import type { ContextoProva } from '../lib/timing/email-resultado';
import { chaveOperadorValida, clienteEhMaquinaOperadora } from '../lib/timing/operator-auth';
import { protegerSegredoLocal, revelarSegredoLocal } from '../lib/timing/secret-storage';
import { redigirEmails } from '../lib/timing/redact-pii';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function configFile() {
  const dir = mkdtempSync(join(tmpdir(), 'kart-email-'));
  dirs.push(dir);
  return join(dir, 'email.json');
}

function fixtureEnvio(dataDir: string) {
  const now = Date.now();
  const session: Session = {
    id: `TESTE-CODEX-${now}`, name: 'TESTE CODEX · 100 Milhas', type: 'corrida', durationMs: 60_000, maxLaps: null,
    minLapMs: 0, state: 'encerrada', createdAt: now - 120_000, startedAt: now - 60_000, checkeredAt: now - 1_000,
    finishedAt: now, semEmailPilotos: false,
    competitors: [
      { kart: 'TESTE-01', name: 'Piloto Teste Um', finished: true, crossings: [
        { decoderTimeMs: 1, wallMs: now - 60_000, lapMs: null, source: 'manual' },
        { decoderTimeMs: 2, wallMs: now - 1_000, lapMs: 59_000, source: 'manual' },
      ] },
      { kart: 'TESTE-02', name: 'Piloto Teste Dois', finished: true, crossings: [
        { decoderTimeMs: 3, wallMs: now - 58_000, lapMs: null, source: 'manual' },
        { decoderTimeMs: 4, wallMs: now - 500, lapMs: 57_500, source: 'manual' },
      ] },
    ],
  };
  const context: ContextoProva = {
    empresa: { nome: 'Kartódromo TESTE CODEX' }, evento: 'TESTE CODEX 100 Milhas', grupo: 'TESTE CODEX', prova: 'Corrida simulada',
    tipo: 'corrida', tracado: 'Pista simulada', quando: now,
    classificacao: [
      { position: 1, kart: 'TESTE-02', name: 'Piloto Teste Dois', category: null, laps: 1, lastLapMs: 57_500, bestLapMs: 57_500, bestLapNumber: 1, totalMs: 57_500, averageSpeedKmh: null, gapMs: null, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: now - 500 },
      { position: 2, kart: 'TESTE-01', name: 'Piloto Teste Um', category: null, laps: 1, lastLapMs: 59_000, bestLapMs: 59_000, bestLapNumber: 1, totalMs: 59_000, averageSpeedKmh: null, gapMs: 1_500, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: now - 1_000 },
    ],
  };
  return { session, context, dataDir };
}

describe('confiabilidade e segurança do email', () => {
  it('exige uma chave configurada e compara a credencial de operador com segurança', () => {
    expect(chaveOperadorValida('chave-local', 'chave-local')).toBe(true);
    expect(chaveOperadorValida('chave-errada', 'chave-local')).toBe(false);
    expect(chaveOperadorValida('chave-local', undefined)).toBe(false);
    expect(clienteEhMaquinaOperadora('::ffff:192.168.20.13', 'CRONO1', 'crono1', ['192.168.20.13'])).toBe(true);
    expect(clienteEhMaquinaOperadora('192.168.20.14', 'CRONO1', 'crono1', ['192.168.20.13'])).toBe(false);
    expect(clienteEhMaquinaOperadora('192.168.20.13', 'outra-maquina', 'crono1', ['192.168.20.13'])).toBe(false);
  });

  it('remove endereços de e-mail de texto operacional antes de registrar logs', () => {
    expect(redigirEmails('SMTP rejeitou piloto@example.com e outra+prova@corrida.example.org')).toBe('SMTP rejeitou [email redigido] e [email redigido]');
  });
  it('reativa automaticamente provas 100 Milhas antigas marcadas para não enviar', () => {
    const sessao = { id: 'teste', name: '100 Milhas - Corrida', semEmailPilotos: true } as Session;
    expect(semEmailAosPilotos(sessao, '100 Milhas')).toBe(false);
    expect(semEmailAosPilotos({ ...sessao, name: 'Tabajara', semEmailPilotos: true } as Session)).toBe(true);
  });

  it('rejeita cabeçalhos injetáveis e normaliza emails de destinatário', () => {
    expect(validarEmailDestinatario(' piloto@example.com ')).toBe('piloto@example.com');
    expect(validarEmailDestinatario('piloto@example.com\r\nBcc: fraud@example.com')).toBeNull();
    expect(sanitizarNomeDestinatario('João\r\n<Bcc: x>')).toBe('João Bcc: x');
  });

  it('não retorna a senha SMTP, mas mantém os campos necessários para editar a configuração autenticada', () => {
    const publico = configPublica({ ...CONFIG_PADRAO, host: 'smtp.private.test', usuario: 'conta@private.test', senha: 'segredo', copiaOculta: 'oculta@private.test' });
    expect(publico).not.toHaveProperty('senha');
    expect(publico.host).toBe('smtp.private.test');
    expect(publico.usuario).toBe('conta@private.test');
    expect(publico.senhaDefinida).toBe(true);
  });

  it('descarta configuração malformada/desconhecida para padrões e rejeita porta não SMTP', () => {
    const file = configFile();
    writeFileSync(file, '{ quebrado');
    expect(lerConfig(file)).toEqual(CONFIG_PADRAO);
    expect(() => salvarConfig(file, { ...CONFIG_PADRAO, porta: 2525 })).toThrow(/porta|TLS/i);
    writeFileSync(file, JSON.stringify({ ...CONFIG_PADRAO, apiKey: 'unexpected' }));
    expect(lerConfig(file)).toEqual(CONFIG_PADRAO);
  });

  it('grava a configuração final em JSON válido sem deixar o temporário', () => {
    const file = configFile();
    const saved = salvarConfig(file, { host: 'smtp.example.com', porta: 587, usuario: 'kart@example.com', senha: 'nova-senha' });
    const disk = JSON.parse(readFileSync(file, 'utf8'));
    expect(disk).toMatchObject({ ...saved, senha: expect.stringMatching(/^dpapi:v1:/) });
    expect(disk.senha).not.toContain('nova-senha');
    expect(revelarSegredoLocal(disk.senha)).toBe('nova-senha');
    expect(lerConfig(file)).toEqual(saved);
  });

  it('protege e recupera a senha com DPAPI LocalMachine', () => {
    const cifrado = protegerSegredoLocal('senha-de-teste');
    expect(cifrado).toMatch(/^dpapi:v1:/);
    expect(cifrado).not.toContain('senha-de-teste');
    expect(revelarSegredoLocal(cifrado)).toBe('senha-de-teste');
  });

  it('migra senha antiga em texto para DPAPI ao ler a configuração', () => {
    const file = configFile();
    writeFileSync(file, JSON.stringify({ ...CONFIG_PADRAO, host: 'smtp.example.com', porta: 587, usuario: 'kart@example.com', senha: 'legada' }));
    expect(lerConfig(file).senha).toBe('legada');
    const disk = JSON.parse(readFileSync(file, 'utf8'));
    expect(disk.senha).toMatch(/^dpapi:v1:/);
    expect(disk.senha).not.toContain('legada');
    expect(lerConfig(file).senha).toBe('legada');
  });

  it('simula o lote do organizador com os dois PDFs anexados e sem sair para a rede', async () => {
    const file = configFile();
    const dir = dirs[dirs.length - 1];
    salvarConfig(file, { ...CONFIG_PADRAO, host: 'smtp.invalid', porta: 587, usuario: 'teste@example.invalid', senha: 'TESTE CODEX', anexarPdf: true });
    const { session, context } = fixtureEnvio(dir);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mensagem capturada do nodemailer
    const capturadas: any[] = [];
    let pdfsGerados = 0;
    const result = await enviarResultado(session, file, {
      dataDir: dir, simulador: true, log: () => undefined, salvarSessao: () => undefined,
      contexto: async () => context, emailsDosClientes: async () => new Map(), logoPng: null,
      simuladorGerarPdf: async () => Buffer.from(`PDF TESTE CODEX ${++pdfsGerados}`),
      simuladorEnviar: async (message) => { capturadas.push(message); return { messageId: '<teste-codex@example.invalid>', message: Buffer.from('EML TESTE CODEX') }; },
    }, { automatico: false, para: 'teste.codex@example.invalid', organizador: true });
    expect(result.status).toBe('enviado');
    expect(result.aceite).toBe('simulador');
    expect(result.entregaConfirmada).toBe(false);
    expect(pdfsGerados).toBe(2);
    expect(capturadas).toHaveLength(1);
    expect(capturadas[0].attachments).toHaveLength(2);
    expect(capturadas[0].attachments.every((a: { contentType?: string }) => a.contentType === 'application/pdf')).toBe(true);
    expect(capturadas[0].html).toContain('PDF, anexados neste e-mail');
  });

  it('cancela o lote simulado quando o PDF volta a volta falha, antes de chamar SMTP', async () => {
    const file = configFile();
    const dir = dirs[dirs.length - 1];
    salvarConfig(file, { ...CONFIG_PADRAO, host: 'smtp.invalid', porta: 587, usuario: 'teste@example.invalid', senha: 'TESTE CODEX', anexarPdf: true });
    const { session, context } = fixtureEnvio(dir);
    let calls = 0;
    let enviados = 0;
    const result = await enviarResultado(session, file, {
      dataDir: dir, simulador: true, log: () => undefined, salvarSessao: () => undefined,
      contexto: async () => context, emailsDosClientes: async () => new Map(), logoPng: null,
      simuladorGerarPdf: async () => (++calls === 1 ? Buffer.from('PDF TESTE CODEX') : null),
      simuladorEnviar: async () => { enviados++; return { messageId: 'unexpected', message: Buffer.from('') }; },
    }, { automatico: false, para: 'teste.codex@example.invalid', organizador: true });
    expect(result.status).toBe('falhou');
    expect(result.falhas[0]?.erro).toMatch(/PDF volta a volta/);
    expect(enviados).toBe(0);
  });
});
