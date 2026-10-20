/** Envio do Cloudflare Email Sending (o mesmo domínio que já manda o resultado das baterias). */
interface SendEmailBinding {
  send(message: { to: string; from: string | { email: string; name?: string }; subject: string; html?: string; text?: string }): Promise<{ messageId: string }>;
}

export interface MobileEmailEnv {
  MOBILE_DB?: D1Database;
  /** binding send_email do wrangler: não precisa de chave (só funciona com o domínio liberado no Email Sending) */
  EMAIL?: SendEmailBinding;
  /** "1" = nem tenta o binding: tudo pela fila que o servidor da cronometragem envia pela HostGator */
  MOBILE_EMAIL_FILA?: string;
  /** remetente do binding; o padrão é o mesmo do resultado das baterias */
  MOBILE_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  /** endereço público das páginas de confirmação (padrão: o domínio das reservas) */
  MOBILE_PUBLIC_URL?: string;
}

export type MobileEmailPurpose = 'verify' | 'reset';

const REMETENTE_PADRAO = 'resultados@kartodromodebetim.com.br';

export function mobileEmailConfigured(env: MobileEmailEnv) {
  return Boolean(env.EMAIL || env.MOBILE_DB || (env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim()));
}

/**
 * Fila do e-mail de conta (20/10/2026): o Email Sending da Cloudflare não está liberado para o domínio (só manda para
 * endereços verificados — E_RECIPIENT_NOT_ALLOWED). O servidor da cronometragem busca a fila a cada 10 s e envia pela
 * HostGator, a mesma saída dos resultados das baterias. A linha some depois de enviada.
 */
async function enfileirar(env: MobileEmailEnv, to: string, subject: string, text: string, html: string) {
  if (!env.MOBILE_DB) return false;
  const agora = Date.now();
  await env.MOBILE_DB.prepare('DELETE FROM mobile_email_outbox WHERE created_at < ?').bind(agora - 3_600_000).run();
  await env.MOBILE_DB.prepare(
    'INSERT INTO mobile_email_outbox(id, to_address, subject, text_body, html_body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), to, subject, text, html, agora).run();
  return true;
}

/** Link https (o app de e-mail abre; a página confirma ou troca a senha mesmo sem o app instalado). */
export function mobileEmailLink(env: MobileEmailEnv, purpose: MobileEmailPurpose, token: string) {
  const base = (env.MOBILE_PUBLIC_URL?.trim() || 'https://reservas.kartodromodebetim.com.br').replace(/\/$/, '');
  return `${base}/conta?acao=${purpose === 'verify' ? 'verificar' : 'senha'}&token=${encodeURIComponent(token)}`;
}

function conteudo(purpose: MobileEmailPurpose, link: string) {
  const verificar = purpose === 'verify';
  const subject = verificar ? 'Confirme seu e-mail · Kartódromo de Betim' : 'Crie uma nova senha · Kartódromo de Betim';
  const acao = verificar ? 'Confirmar meu e-mail' : 'Criar nova senha';
  const intro = verificar
    ? 'Falta só confirmar seu e-mail para usar sua conta no app do Kartódromo de Betim (reservas, resultados e carreira).'
    : 'Recebemos um pedido para trocar a senha da sua conta no app do Kartódromo de Betim.';
  const fim = verificar ? '' : ' Se não foi você, ignore este e-mail: sua senha continua a mesma.';
  const href = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const text = `${intro}\n\n${acao}: ${link}\n\nO link vale por 30 minutos.${fim}\n\nKartódromo Internacional de Betim`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:13px;font-weight:bold;letter-spacing:.08em;color:#e4002b;margin:0 0 10px">KARTÓDROMO DE BETIM</p>
<h1 style="font-size:22px;margin:0 0 14px">${verificar ? 'Confirme seu e-mail' : 'Crie uma nova senha'}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 22px">${intro}</p>
<p style="margin:0 0 22px"><a href="${href}" style="display:inline-block;background:#e4002b;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 22px;border-radius:8px">${acao}</a></p>
<p style="font-size:13px;line-height:1.5;color:#52525b;margin:0">O link vale por 30 minutos.${fim}</p>
</div></body></html>`;
  return { subject, text, html };
}

export async function sendMobileAuthEmail(
  env: MobileEmailEnv,
  to: string,
  purpose: MobileEmailPurpose,
  token: string,
) {
  if (!mobileEmailConfigured(env)) return false;
  const { subject, text, html } = conteudo(purpose, mobileEmailLink(env, purpose, token));

  if (env.EMAIL && env.MOBILE_EMAIL_FILA !== '1') {
    try {
      await env.EMAIL.send({
        to,
        from: { email: env.MOBILE_EMAIL_FROM?.trim() || REMETENTE_PADRAO, name: 'Kartódromo de Betim' },
        subject,
        text,
        html,
      });
      return true;
    } catch (e) {
      console.error('mobile email binding', (e as { code?: string }).code ?? '', (e as Error).message);
    }
  }
  if (env.MOBILE_DB && !(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim())) {
    try { return await enfileirar(env, to, subject, text, html); }
    catch (e) { console.error('mobile email outbox', (e as Error).message); return false; }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, text, html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
