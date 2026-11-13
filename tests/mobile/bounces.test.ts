import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assinaturaValida, emailsQueVoltaram, handleResendWebhook, soEndereco } from '../../workers/pre-cadastro/src/mobile/bounces';

const SEGREDO = 'whsec_' + btoa('segredo-de-teste-do-webhook-123');

async function assinar(id: string, ts: string, corpo: string) {
  const bytes = Uint8Array.from(atob(SEGREDO.slice(6)), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${id}.${ts}.${corpo}`)));
  return 'v1,' + btoa(String.fromCharCode(...mac));
}

async function chamar(env: Parameters<typeof handleResendWebhook>[1], evento: unknown, opcoes: { assinatura?: string; ts?: string } = {}) {
  const corpo = JSON.stringify(evento);
  const ts = opcoes.ts ?? String(Math.floor(Date.now() / 1000));
  const assinatura = opcoes.assinatura ?? await assinar('msg_1', ts, corpo);
  return handleResendWebhook(new Request('https://cadastro.example/api/resend/webhook', {
    method: 'POST', body: corpo, headers: { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': assinatura },
  }), env);
}

const voltou = (to: string[], tipo = 'Permanent') => ({
  type: 'email.bounced', created_at: '2026-11-12T23:01:00.000Z',
  data: { to, subject: 'Resultado oficial · BATERIA 19:55', bounce: { type: tipo, subType: 'General', message: 'The email account does not exist.' } },
});

describe('e-mails que voltaram (webhook do Resend)', () => {
  let mf: Miniflare;
  let db: D1Database;
  beforeEach(async () => {
    mf = new Miniflare({ compatibilityDate: '2026-06-26', modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: ['DB'] });
    db = (await mf.getD1Database('DB')) as unknown as D1Database;
  });
  afterEach(async () => { await mf.dispose(); });

  it('grava a recusa definitiva e a recepção consulta pelo endereço em minúsculas', async () => {
    const r = await chamar({ MOBILE_DB: db, RESEND_WEBHOOK_SECRET: SEGREDO }, voltou(['"Pablo Henrique" <PabloRei43@gmail.com>']));
    expect(r.status).toBe(200);
    const lista = await emailsQueVoltaram(db, Date.parse('2026-11-13T12:00:00Z'));
    expect(lista['pablorei43@gmail.com']).toMatchObject({ motivo: 'The email account does not exist.', assunto: 'Resultado oficial · BATERIA 19:55' });
  });

  it('ignora a recusa temporária (caixa cheia, servidor fora do ar)', async () => {
    expect((await chamar({ MOBILE_DB: db, RESEND_WEBHOOK_SECRET: SEGREDO }, voltou(['a@b.com'], 'Transient'))).status).toBe(200);
    expect(await emailsQueVoltaram(db)).toEqual({});
  });

  it('recusa assinatura errada, antiga ou sem segredo configurado', async () => {
    expect((await chamar({ MOBILE_DB: db, RESEND_WEBHOOK_SECRET: SEGREDO }, voltou(['a@b.com']), { assinatura: 'v1,abc' })).status).toBe(401);
    const velho = String(Math.floor(Date.now() / 1000) - 3600);
    expect((await chamar({ MOBILE_DB: db, RESEND_WEBHOOK_SECRET: SEGREDO }, voltou(['a@b.com']), { ts: velho })).status).toBe(401);
    expect((await chamar({ MOBILE_DB: db }, voltou(['a@b.com']))).status).toBe(503);
    expect(await emailsQueVoltaram(db)).toEqual({});
  });

  it('normaliza o endereço e valida a assinatura Svix', async () => {
    expect(soEndereco('"Isaac" <JOSE@Gmail.com>')).toBe('jose@gmail.com');
    const ts = String(Math.floor(Date.now() / 1000));
    expect(await assinaturaValida(SEGREDO, 'msg_1', ts, 'v1,xyz ' + await assinar('msg_1', ts, '{}'), '{}')).toBe(true);
  });
});
