import { describe, expect, it, vi } from 'vitest';
import { CONFIG_PADRAO, opcoesTransporte, situacaoEnvioEmail, situacaoTesteEmail, traduzirErro } from '../services/timing-email';

vi.mock('../lib/timing/secret-storage', async (real) => (process.platform === 'win32' ? real() : import('./segredo-local-simulado')));

describe('transporte SMTP dos resultados', () => {
  it('anuncia um FQDN no EHLO em vez do fallback [127.0.0.1]', () => {
    const opcoes = opcoesTransporte({ ...CONFIG_PADRAO, usuario: 'resultados@kartodromodebetim.com.br', senha: 'nao-exibir' }, false) as { name?: string };
    expect(opcoes.name).toBe('mail.kartodromodebetim.com.br');
    expect(opcoes.name).not.toBe('[127.0.0.1]');
  });

  it('substitui um host SMTP local por um nome público seguro', () => {
    const opcoes = opcoesTransporte({ ...CONFIG_PADRAO, host: '127.0.0.1', usuario: 'resultados@kartodromodebetim.com.br', senha: 'nao-exibir' }, false) as { name?: string };
    expect(opcoes.name).toBe('mail.kartodromodebetim.com.br');
  });

  it('não confunde o aceite do relay com recebimento na caixa do destinatário', () => {
    const situacao = situacaoTesteEmail({ tipo: 'success', motivo: 'Aceito' });
    expect(situacao).toMatchObject({ status: 'aceito-pelo-relay', entregaConfirmada: false });
    expect(situacao.mensagem).toContain('caixa do destinatário');
  });

  it('informa quando o rastreio final não está disponível', () => {
    const situacao = situacaoTesteEmail(null);
    expect(situacao).toMatchObject({ status: 'aceito-pelo-smtp', entregaConfirmada: false });
    expect(situacao.mensagem).toContain('não foi possível confirmar');
  });

  it('mantém o mesmo aviso honesto nos resultados da prova', () => {
    const situacao = situacaoEnvioEmail({ tipo: 'success', motivo: 'Aceito' }, false);
    expect(situacao).toMatchObject({ status: 'aceito-pelo-relay', entregaConfirmada: false });
    expect(situacao.mensagem).toContain('caixa do destinatário');
  });

  it('identifica o simulador sem chamar isso de entrega', () => {
    const situacao = situacaoEnvioEmail(null, true);
    expect(situacao).toMatchObject({ status: 'simulador', entregaConfirmada: false });
  });
});

describe('remetente do e-mail', () => {
  it('sai sempre pela caixa autenticada da HostGator', async () => {
    const { enderecoRemetente, salvarConfig } = await import('../services/timing-email');
    const base = { ...CONFIG_PADRAO, host: 'mail.kartodromodebetim.com.br', porta: 465, usuario: 'crono@kartodromodebetim.com.br', senha: 'nao-exibir' };
    expect(enderecoRemetente({ ...base, remetenteEmail: 'cronokartbetim@gmail.com' }, 'x@y.z')).toBe('crono@kartodromodebetim.com.br');
    expect(enderecoRemetente({ ...base, remetenteEmail: 'resultados@kartodromodebetim.com.br' }, 'x@y.z')).toBe('resultados@kartodromodebetim.com.br');
    expect(enderecoRemetente({ ...base, remetenteEmail: '' }, 'x@y.z')).toBe('crono@kartodromodebetim.com.br');

    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const arq = join(mkdtempSync(join(tmpdir(), 'email-')), 'email.json');
    writeFileSync(arq, JSON.stringify({ ...base, usuario: 'cronokartbetim@gmail.com', remetenteEmail: 'cronokartbetim@gmail.com' }));
    const novo = salvarConfig(arq, { usuario: 'crono@kartodromodebetim.com.br', senha: 'outra' });
    expect(novo.remetenteEmail).toBe('');
  });
});

describe('SMTP do Cloudflare', () => {
  it('aceita o usuário api_token e sai como crono@', async () => {
    const { enderecoRemetente, salvarConfig, opcoesTransporte, conferirEntrega } = await import('../services/timing-email');
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const arq = join(mkdtempSync(join(tmpdir(), 'email-')), 'email.json');
    writeFileSync(arq, JSON.stringify({ ...CONFIG_PADRAO, usuario: 'crono@kartodromodebetim.com.br', senha: 'antiga', remetenteEmail: '' }));
    const novo = salvarConfig(arq, { host: 'smtp.mx.cloudflare.net', porta: 465, usuario: 'api_token', senha: 'nao-exibir' });
    expect(novo.usuario).toBe('api_token');
    expect(enderecoRemetente(novo)).toBe('crono@kartodromodebetim.com.br');
    expect(enderecoRemetente({ ...novo, remetenteEmail: 'resultados@kartodromodebetim.com.br' })).toBe('resultados@kartodromodebetim.com.br');
    expect((opcoesTransporte(novo, false) as { name?: string; secure?: boolean })).toMatchObject({ name: 'mail.kartodromodebetim.com.br', secure: true });
    expect(await conferirEntrega(novo, Date.now())).toBeNull();
    expect(() => salvarConfig(arq, { host: 'mail.kartodromodebetim.com.br', usuario: 'api_token' })).toThrow();
  });
});

describe('Tabajara: resultado com o organizador', () => {
  it('bateria com "Tabajara" no nome não manda aos pilotos; a marcação na bateria vale mais que o nome', async () => {
    const { semEmailAosPilotos } = await import('../services/timing-email');
    const s = { name: 'BATERIA 20:00 · CORRIDA' } as Parameters<typeof semEmailAosPilotos>[0];
    expect(semEmailAosPilotos(s)).toBe(false);
    expect(semEmailAosPilotos(s, 'Tabajara do Lucas Prates')).toBe(true);
    expect(semEmailAosPilotos({ ...s, name: 'TABAJARA · CORRIDA' })).toBe(true);
    expect(semEmailAosPilotos({ ...s, name: 'TABAJARA · CORRIDA', semEmailPilotos: false })).toBe(false);
    expect(semEmailAosPilotos({ ...s, semEmailPilotos: true })).toBe(true);
  });

  it('volta a volta de todos os pilotos num PDF só, um por página', async () => {
    const { htmlPdfVoltaAVoltaTodos } = await import('../lib/timing/email-resultado');
    const ctx = { empresa: { nome: 'Kartódromo' }, grupo: 'Tabajara', prova: 'Corrida', classificacao: [] } as unknown as Parameters<typeof htmlPdfVoltaAVoltaTodos>[0];
    const p = (nome: string, kart: string) => ({ nome, kart, email: '', standing: null, voltas: [{ numero: 1, ms: 60_000, anulada: false, melhor: true, hora: 0 }] });
    const html = htmlPdfVoltaAVoltaTodos(ctx, [p('ANA', '7'), p('BRUNO', '12')], null);
    expect(html.match(/<section/g)).toHaveLength(2);
    expect(html.match(/<section style="page-break-before:always"/g)).toHaveLength(1);
    expect(html).toContain('kart 12');
  });
});

describe('erros do servidor de e-mail em português', () => {
  it('limite por hora da HostGator não vira "não aceitou o destinatário" (13/10: 550 (500/500 (100%)) allowed)', () => {
    expect(traduzirErro(new Error('Can\'t send mail - all recipients were rejected: 550 (500/500 (100%)) allowed.  Message discarded.'))).toMatch(/limite de e-mails por hora/);
    expect(traduzirErro(new Error('550 relay not permitted'))).toBe('o servidor de e-mail não aceitou o destinatário');
  });

  it('não marca limite de 500 e-mails/hora da HostGator (550) como falha permanente e reenvia com somenteFaltantes mesmo se sessão antiga foi marcada permanente', async () => {
    const { ehErroLimitePorHora, enviarResultado, salvarConfig } = await import('../services/timing-email');
    const { mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'email-limite-'));
    const file = join(dir, 'email.json');
    salvarConfig(file, { ...CONFIG_PADRAO, host: 'smtp.invalid', porta: 587, usuario: 'teste@example.invalid', senha: 'TESTE CODEX', anexarPdf: false });
    const now = Date.now();
    const session: Parameters<typeof enviarResultado>[0] = {
      id: 'TESTE-CODEX-LIMITE', name: 'CLUBE DA INSÔNIA · Corrida', type: 'corrida', durationMs: 60_000, maxLaps: null,
      minLapMs: 0, state: 'encerrada', createdAt: now - 120_000, startedAt: now - 60_000, checkeredAt: now - 1_000, finishedAt: now,
      competitors: [
        { kart: '01', name: 'Piloto Um', customerId: '1', finished: true, crossings: [{ decoderTimeMs: 1, wallMs: now - 60_000, lapMs: null }, { decoderTimeMs: 2, wallMs: now - 1_000, lapMs: 55_000 }] },
        { kart: '02', name: 'Piloto Dois', customerId: '2', finished: true, crossings: [{ decoderTimeMs: 1, wallMs: now - 59_000, lapMs: null }, { decoderTimeMs: 2, wallMs: now - 500, lapMs: 56_000 }] },
      ],
    };
    const context = {
      empresa: { nome: 'Kartódromo TESTE CODEX' }, evento: 'Clube da Insônia', grupo: 'CLUBE DA INSÔNIA', prova: 'Corrida',
      tipo: 'corrida' as const, tracado: 'Normal', quando: now,
      classificacao: [
        { position: 1, kart: '01', name: 'Piloto Um', category: null, laps: 1, lastLapMs: 55_000, bestLapMs: 55_000, bestLapNumber: 1, totalMs: 55_000, averageSpeedKmh: null, gapMs: null, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: now - 1_000 },
        { position: 2, kart: '02', name: 'Piloto Dois', category: null, laps: 1, lastLapMs: 56_000, bestLapMs: 56_000, bestLapNumber: 1, totalMs: 56_000, averageSpeedKmh: null, gapMs: 1_000, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: now - 500 },
      ],
    };
    const emails = new Map([['1', 'piloto1@example.invalid'], ['2', 'piloto2@example.invalid']]);

    expect(ehErroLimitePorHora('550 (500/500 (100%)) allowed. Message discarded.')).toBe(true);
    expect(ehErroLimitePorHora('limite de e-mails por hora da hospedagem atingido (500 por hora)')).toBe(true);
    expect(ehErroLimitePorHora('550 NoSuchUser')).toBe(false);

    const r1 = await enviarResultado(session, file, {
      dataDir: dir, simulador: true, log: () => undefined, salvarSessao: () => undefined,
      contexto: async () => context, emailsDosClientes: async () => emails, logoPng: null,
      simuladorEnviar: async () => {
        throw Object.assign(new Error("Can't send mail - all recipients were rejected: 550 (500/500 (100%)) allowed. Message discarded."), { responseCode: 550 });
      },
    }, { automatico: true, assinaturaResultado: 'sig-v1' });
    expect(r1.status).toBe('falhou');
    expect(r1.falhasPermanentes).toEqual([]);
    expect(r1.falhas.every((f) => !f.permanente)).toBe(true);
    expect(r1.proximaTentativaEm).toBeGreaterThan(Date.now());
    expect(r1.assinaturaResultado).toBe('sig-v1');

    // Simula sessão salva anteriormente com permanente: true por engano
    session.emailsResultado = {
      ...r1,
      status: 'falhou-permanente',
      falhas: r1.falhas.map((f) => ({ ...f, permanente: true })),
      falhasPermanentes: ['01|piloto1@example.invalid', '02|piloto2@example.invalid'],
    };

    const enviados2: string[] = [];
    const r2 = await enviarResultado(session, file, {
      dataDir: dir, simulador: true, log: () => undefined, salvarSessao: () => undefined,
      contexto: async () => context, emailsDosClientes: async () => emails, logoPng: null,
      simuladorEnviar: async (m) => { enviados2.push(String(m.to)); return { messageId: '<ok@example.invalid>', message: Buffer.from('EML') }; },
    }, { automatico: false, somenteFaltantes: true, aviso: 'Correção do nome da prova' });
    expect(r2.status).toBe('enviado');
    expect(r2.enviados).toHaveLength(2);
    expect(r2.falhas).toEqual([]);
    expect(r2.falhasPermanentes).toEqual([]);
    expect(r2.assinaturaResultado).toBe('sig-v1');
    expect(enviados2).toHaveLength(2);
  });
});