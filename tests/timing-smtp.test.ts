import { describe, expect, it } from 'vitest';
import { CONFIG_PADRAO, opcoesTransporte, situacaoEnvioEmail, situacaoTesteEmail, traduzirErro } from '../services/timing-email';

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
});