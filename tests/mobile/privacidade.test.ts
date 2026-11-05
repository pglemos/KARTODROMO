import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A política do app existe em dois lugares (página do site Next e a publicada em reservas.*/privacidade): mesmo texto.
const site = readFileSync('app/privacidade/page.tsx', 'utf8');
const publicada = readFileSync('workers/pre-cadastro/public/privacidade.html', 'utf8');

describe('política de privacidade do app', () => {
  it.each([
    'Instagram de quem reserva',
    'associado à sua conta automaticamente',
    'A aba Ao vivo mostra nome, kart e tempos',
    'envio dos e-mails da conta (Cloudflare)',
    'excluir sua conta no próprio app',
    'Esta é uma minuta em revisão',
  ])('as duas versões dizem: %s', (trecho) => {
    expect(site).toContain(trecho);
    expect(publicada).toContain(trecho);
  });

  it('não cita mais o Resend (o e-mail da conta sai pela Cloudflare)', () => {
    expect(site).not.toContain('Resend');
    expect(publicada).not.toContain('Resend');
  });
});
