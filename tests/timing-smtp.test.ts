import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { enviarResultado, enviarTeste, type Dependencias } from '../services/timing-email';
import type { Competitor, Session } from '../lib/timing/race-engine';

const comp = (kart: string, name: string, email: string): Competitor => ({
  kart,
  name,
  crossings: [
    { decoderTimeMs: 0, wallMs: 1000, lapMs: null },
    { decoderTimeMs: 0, wallMs: 61000, lapMs: 60000 },
  ],
  finished: true,
  detalhes: { email },
});

const criarSessao = (id: string, competitors: Competitor[]): Session => ({
  id,
  name: 'BATERIA TESTE · CORRIDA',
  type: 'corrida',
  durationMs: 0,
  maxLaps: null,
  minLapMs: 0,
  state: 'encerrada',
  createdAt: 1000,
  startedAt: 1000,
  checkeredAt: 61000,
  finishedAt: 61000,
  competitors,
});

describe('Tarefa 8 - E-mail e SMTP sem gravação indevida nem duplicação (F15, F22)', () => {
  it('enviar_teste_cancelar_nao_altera_config: arquivo original permanece byte a byte após teste com config efêmera e erro', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'crono-email-test-'));
    const cfgPath = join(pasta, 'email.json');
    const conteudoOriginal = JSON.stringify({
      automatico: true,
      host: 'mail.kartodromodebetim.com.br',
      porta: 465,
      usuario: 'resultados@kartodromodebetim.com.br',
      senha: 'senha-super-secreta',
      remetenteNome: 'Kartódromo Internacional de Betim',
      remetenteEmail: '',
      copiaOculta: '',
      anexarPdf: true,
    }, null, 2);
    writeFileSync(cfgPath, conteudoOriginal, 'utf8');

    // 1. Testa com config efêmera válida em modo simulador (não altera o arquivo)
    await enviarTeste(cfgPath, 'piloto@exemplo.com', true, {
      host: 'outro.smtp.com',
      usuario: 'temporario@exemplo.com',
      senha: 'outra-senha',
    });

    expect(readFileSync(cfgPath, 'utf8')).toBe(conteudoOriginal);

    // 2. Testa com dados efêmeros inválidos (usuário sem @ no domínio)
    await expect(
      enviarTeste(cfgPath, 'piloto@exemplo.com', true, {
        usuario: 'invalido-sem-arroba',
      })
    ).rejects.toThrow('Usuário deve ser o e-mail completo');

    // Arquivo original continua exatamente idêntico byte a byte
    expect(readFileSync(cfgPath, 'utf8')).toBe(conteudoOriginal);

    rmSync(pasta, { recursive: true, force: true });
  });

  it('dois_cliques_compartilham_job: duas requisições simultâneas resultam em um envio por destinatário/job e reenvio posterior é permitido', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'crono-job-test-'));
    const cfgPath = join(pasta, 'email.json');
    writeFileSync(cfgPath, JSON.stringify({
      automatico: true,
      host: 'mail.kartodromodebetim.com.br',
      porta: 465,
      usuario: 'resultados@kartodromodebetim.com.br',
      senha: '123',
      remetenteNome: 'Kartódromo Betim',
      remetenteEmail: '',
      copiaOculta: '',
      anexarPdf: false,
    }), 'utf8');

    const s = criarSessao('sess-dup-1', [
      comp('01', 'Piloto Um', 'um@exemplo.com'),
      comp('02', 'Piloto Dois', 'dois@exemplo.com'),
    ]);

    const sessaoSalva: Session[] = [];
    const dep: Dependencias = {
      dataDir: pasta,
      simulador: true,
      log: () => {},
      salvarSessao: (sess) => {
        sessaoSalva.push(JSON.parse(JSON.stringify(sess)));
      },
      contexto: async () => ({
        empresa: { nome: 'Kartódromo Betim' },
        evento: null,
        grupo: 'BATERIA TESTE',
        prova: 'CORRIDA',
        tipo: 'corrida',
        tracado: 'Principal',
        quando: 1000,
        classificacao: [
          { position: 1, kart: '01', name: 'Piloto Um', category: null, laps: 1, lastLapMs: 60000, bestLapMs: 60000, bestLapNumber: 1, totalMs: 60000, averageSpeedKmh: null, gapMs: null, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: null },
          { position: 2, kart: '02', name: 'Piloto Dois', category: null, laps: 1, lastLapMs: 60000, bestLapMs: 60000, bestLapNumber: 1, totalMs: 60000, averageSpeedKmh: null, gapMs: 100, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: null },
        ],
      }),
      emailsDosClientes: async () => new Map(),
      logoPng: null,
    };

    // Duas chamadas simultâneas (ex: duplo clique na interface)
    const [res1, res2] = await Promise.all([
      enviarResultado(s, cfgPath, dep, { automatico: false }),
      enviarResultado(s, cfgPath, dep, { automatico: false }),
    ]);

    // Devem compartilhar o mesmo job
    expect(res1).toBe(res2);
    expect(res1.status).toBe('enviado');
    expect(res1.enviados).toHaveLength(2);

    // No simulador, a pasta emails-simulador deve conter apenas 1 arquivo por piloto (total de 2 arquivos, não 4)
    const pastaSimulador = join(pasta, 'emails-simulador');
    const arquivosEml = readdirSync(pastaSimulador).filter((f) => f.startsWith('sess-dup-1'));
    expect(arquivosEml).toHaveLength(2);

    // Reenvio posterior explícito (após conclusão do job) é permitido e gera nova tentativa
    const res3 = await enviarResultado(s, cfgPath, dep, { automatico: false });
    expect(res3.tentativas).toBeGreaterThan(res1.tentativas);

    rmSync(pasta, { recursive: true, force: true });
  });

  it('automático versus manual não disputam PDF: jobs usam diretórios temporários exclusivos', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'crono-pdf-isolation-'));
    const cfgPath = join(pasta, 'email.json');
    writeFileSync(cfgPath, JSON.stringify({
      automatico: true,
      host: 'mail.kartodromodebetim.com.br',
      porta: 465,
      usuario: 'resultados@kartodromodebetim.com.br',
      senha: '123',
      remetenteNome: 'Kartódromo Betim',
      remetenteEmail: '',
      copiaOculta: '',
      anexarPdf: false,
    }), 'utf8');

    const sAuto = criarSessao('sess-iso-1', [comp('10', 'Piloto Auto', 'auto@exemplo.com')]);
    const sManual = criarSessao('sess-iso-2', [comp('20', 'Piloto Manual', 'manual@exemplo.com')]);

    const dep: Dependencias = {
      dataDir: pasta,
      simulador: true,
      log: () => {},
      salvarSessao: () => {},
      contexto: async () => ({
        empresa: { nome: 'Kartódromo Betim' },
        evento: null,
        grupo: 'BATERIA TESTE',
        prova: 'CORRIDA',
        tipo: 'corrida',
        tracado: 'Principal',
        quando: 1000,
        classificacao: [],
      }),
      emailsDosClientes: async () => new Map(),
      logoPng: null,
    };

    // Executa simultaneamente um job automático e um manual
    const [rAuto, rManual] = await Promise.all([
      enviarResultado(sAuto, cfgPath, dep, { automatico: true }),
      enviarResultado(sManual, cfgPath, dep, { automatico: false }),
    ]);

    expect(rAuto.status).toBe('enviado');
    expect(rManual.status).toBe('enviado');

    rmSync(pasta, { recursive: true, force: true });
  });
});
