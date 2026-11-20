import { describe, expect, it } from 'vitest';
import { ehCotaDiariaDoResend, proximaRenovacaoDoResend, servidorForaAte, traduzirErro } from '../services/timing-email';

describe('saída de reserva quando o Resend esgota a cota diária (20/11/2026)', () => {
  it('reconhece a cota diária no texto bruto da API e no texto já traduzido', () => {
    const bruto = 'Resend 429: {"message":"You have reached your daily email sending quota.","name":"daily_quota_exceeded"}';
    expect(ehCotaDiariaDoResend(bruto)).toBe(true);
    expect(ehCotaDiariaDoResend(traduzirErro(new Error(bruto)))).toBe(true);
  });

  it('não confunde com o limite por hora da hospedagem nem com outro erro', () => {
    expect(ehCotaDiariaDoResend('550 (500/500 (100%)) allowed')).toBe(false);
    expect(ehCotaDiariaDoResend('certificate has expired')).toBe(false);
  });

  it('a cota renova às 21h de Brasília (00:00 UTC do dia seguinte)', () => {
    expect(new Date(proximaRenovacaoDoResend(Date.parse('2026-11-20T19:36:33Z'))).toISOString()).toBe('2026-11-21T00:00:00.000Z');
    expect(new Date(proximaRenovacaoDoResend(Date.parse('2026-11-20T23:59:59Z'))).toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });
});

describe('cadeia Resend → HostGator → Gmail: quando um servidor sai da vez', () => {
  const agora = Date.parse('2026-11-20T20:00:00Z');
  it('cota diária do Resend: fora até as 21h de Brasília', () => {
    expect(servidorForaAte('Resend 429: daily_quota_exceeded', agora)).toBe(Date.parse('2026-11-21T00:00:00Z'));
  });
  it('limite por hora da hospedagem: fora 1 h; limite diário do Gmail: 24 h', () => {
    expect(servidorForaAte('550 (500/500 (100%)) allowed', agora)).toBe(agora + 3_600_000);
    expect(servidorForaAte('550 5.4.5 Daily user sending limit exceeded', agora)).toBe(agora + 24 * 3_600_000);
  });
  it('certificado vencido, senha recusada ou sem conexão: fora 15 min', () => {
    for (const erro of ['certificate has expired', '535 Incorrect authentication data', 'connect ETIMEDOUT 162.241.61.95:465', 'getaddrinfo ENOTFOUND mail.x']) {
      expect(servidorForaAte(erro, agora), erro).toBe(agora + 15 * 60_000);
    }
  });
  it('erro do destinatário não derruba o servidor', () => {
    expect(servidorForaAte('550 5.1.1 The email account that you tried to reach does not exist', agora)).toBe(0);
    expect(servidorForaAte('destinatário inválido', agora)).toBe(0);
  });
});
