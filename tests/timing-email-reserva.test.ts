import { describe, expect, it } from 'vitest';
import { ehCotaDiariaDoResend, proximaRenovacaoDoResend, traduzirErro } from '../services/timing-email';

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
