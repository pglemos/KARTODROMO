import { describe, expect, it } from 'vitest';
import { enviarPelaApiResend } from '../services/timing-email';

describe('envio pela API do Resend', () => {
  it('monta o POST com remetente, anexos em base64 e imagem inline', async () => {
    let corpo: Record<string, unknown> = {};
    let auth = '';
    const fetcher = (async (_url: string, init: RequestInit) => {
      corpo = JSON.parse(String(init.body));
      auth = (init.headers as Record<string, string>).authorization;
      return new Response('{"id":"abc"}', { status: 200 });
    }) as unknown as typeof fetch;
    const r = await enviarPelaApiResend('re_teste', {
      from: { name: 'Kartódromo', address: 'resultados@kartodromodebetim.com.br' },
      to: 'piloto@exemplo.com', subject: 'Resultado', html: '<img src="cid:logo">', text: 'oi',
      attachments: [{ filename: 'logo.png', content: Buffer.from('png'), contentType: 'image/png', cid: 'logo' }],
    }, fetcher);
    expect(r.messageId).toBe('abc');
    expect(auth).toBe('Bearer re_teste');
    expect(corpo.from).toBe('Kartódromo <resultados@kartodromodebetim.com.br>');
    expect(corpo.to).toEqual(['piloto@exemplo.com']);
    expect(corpo.attachments).toEqual([{ filename: 'logo.png', content: Buffer.from('png').toString('base64'), content_type: 'image/png', content_id: 'logo' }]);
  });

  it('erro de validação é permanente e limite/instabilidade é temporário', async () => {
    const com = (status: number) => (async () => new Response('{"message":"x"}', { status })) as unknown as typeof fetch;
    const m = { from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' };
    await expect(enviarPelaApiResend('re_x', m, com(422))).rejects.toMatchObject({ responseCode: 550 });
    await expect(enviarPelaApiResend('re_x', m, com(429))).rejects.toMatchObject({ responseCode: 451 });
    await expect(enviarPelaApiResend('re_x', m, com(503))).rejects.toMatchObject({ responseCode: 451 });
  });
});
