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

const LOGO = 'https://reservas.kartodromodebetim.com.br/kib-logo-escuro.png';
const KART = 'https://reservas.kartodromodebetim.com.br/email-kart.gif?v=2';
const xadrez = (inverte: boolean) => Array.from({ length: 45 }, (_, i) => `<td height="10" style="background:${(i + (inverte ? 1 : 0)) % 2 ? '#ffffff' : '#0b0b0d'};font-size:0;line-height:0">&nbsp;</td>`).join('');

/** E-mail da conta com a cara do kartódromo: logo, faixa xadrez de bandeirada, botão dourado e os atalhos do app. */
export function conteudo(purpose: MobileEmailPurpose, link: string) {
  const verificar = purpose === 'verify';
  const subject = verificar ? '🏁 Seu kart está no grid — falta só a largada!' : '🔧 Pit stop: crie sua nova senha · Kartódromo de Betim';
  const acao = verificar ? 'Confirmar e acelerar 🏎️' : 'Criar nova senha';
  const titulo = verificar ? 'Motor ligado. Falta a largada!' : 'Pit stop rápido';
  const intro = verificar
    ? 'Bem-vindo ao Kartódromo Internacional de Betim! Sua conta já está aquecendo os pneus no grid. Confirme seu e-mail e libere tudo: reserve baterias em segundos, acompanhe cada volta ao vivo e construa sua carreira de piloto — com XP, conquistas e categorias de Novato a Lenda.'
    : 'Recebemos um pedido para trocar a senha da sua conta. É rapidinho: toque no botão, escolha uma senha nova e volte para a pista em segundos.';
  const fim = verificar ? 'Se você não criou esta conta, é só ignorar este e-mail.' : 'Se não foi você, ignore este e-mail: sua senha continua a mesma.';
  const vantagens = verificar
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px"><tr>${[['🏎️', 'Reserve sua bateria'], ['⏱️', 'Tempos ao vivo'], ['🏆', 'Ranking e carreira']]
      .map(([e, t]) => `<td align="center" width="32%" style="padding:12px 4px;background:#17171b;border-radius:14px;font-size:12px;color:#d4d4d8"><div style="font-size:22px;line-height:30px">${e}</div>${t}</td>`)
      .join('<td width="2%"></td>')}</tr></table>`
    : '';
  // desafio e escada de categorias: um gostinho do que vem depois da confirmação
  const categorias = verificar
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:#141418;border-radius:16px"><tr><td style="padding:18px 18px 16px">
<p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.14em;color:#f59e0b">🔥 SEU DESAFIO DE ESTREIA</p>
<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#d4d4d8">Confirme, reserve sua primeira bateria e tente entrar no <b style="color:#ffffff">top 10 da semana</b>. Cada bateria vale XP — e cada pódio te leva mais perto do topo.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[['NOVATO', '#9ca3af'], ['AMADOR', '#22c55e'], ['SEMI-PRO', '#3b82f6'], ['PRO', '#a855f7'], ['LENDA', '#f59e0b']]
      .map(([n, c], i) => `<td align="center" style="padding:7px 2px;border-radius:999px;background:${i === 0 ? c : '#1f1f25'};color:${i === 0 ? '#000000' : c};font-size:10px;font-weight:900;letter-spacing:.06em">${n}</td>`).join('<td width="4" style="font-size:10px;color:#3f3f46">›</td>')}</tr></table>
<p style="margin:10px 0 0;font-size:12px;color:#71717a">Você começa aqui ⬆️ Até onde vai chegar?</p></td></tr></table>`
    : '';
  const href = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const text = `${titulo}\n\n${intro}\n\n${acao}: ${link}\n\nO link vale por 30 minutos. ${fim}\n\nKartódromo Internacional de Betim`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#0b0b0d;border-radius:24px;overflow:hidden;border:1px solid #26262b">
<tr><td align="center" style="padding:30px 24px 24px"><img src="${LOGO}" width="240" alt="Kartódromo Internacional de Betim" style="display:block;width:240px;max-width:80%;height:auto;border:0"></td></tr>
<tr><td style="line-height:0;font-size:0"><img src="${KART}" width="540" alt="Karts disputando a curva na pista do Kartódromo de Betim" style="display:block;width:100%;max-width:540px;height:auto;border:0"></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${xadrez(false)}</tr><tr>${xadrez(true)}</tr></table></td></tr>
<tr><td style="padding:32px 28px 8px">
<p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.18em;color:#f59e0b">APP DO PILOTO</p>
<h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;color:#ffffff;font-weight:900">${titulo}</h1>
<p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#a1a1aa">${intro}</p>
${vantagens}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:999px;background:#f59e0b">
<a href="${href}" style="display:block;padding:17px 24px;font-size:17px;font-weight:900;color:#000000;text-decoration:none;border-radius:999px">${acao} →</a></td></tr></table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#71717a;text-align:center">⏱️ O link vale por 30 minutos. ${fim}</p>
${categorias}
</td></tr>
<tr><td style="padding:26px 28px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #26262b"><tr><td style="padding-top:18px;font-size:12px;line-height:1.6;color:#71717a;text-align:center">
<b style="color:#a1a1aa">Nos vemos na pista! 🏁</b><br>Kartódromo Internacional de Betim · Betim/MG<br>E-mail automático do app. Não precisa responder.</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

// Email Sending da Cloudflare (Workers Paid): 3.000 e-mails/mês inclusos. Passando de 2.500 no mês, vai pela fila
// (servidor da cronometragem) para nunca gerar cobrança além do plano.
const LIMITE_MES = 2500;
async function cotaDoMes(env: MobileEmailEnv) {
  if (!env.MOBILE_DB) return true;
  const mes = new Date().toISOString().slice(0, 7);
  await env.MOBILE_DB.prepare('CREATE TABLE IF NOT EXISTS mobile_email_cota (mes TEXT PRIMARY KEY, enviados INTEGER NOT NULL)').run();
  const r = await env.MOBILE_DB.prepare('SELECT enviados FROM mobile_email_cota WHERE mes = ?').bind(mes).first<{ enviados: number }>();
  return (r?.enviados ?? 0) < LIMITE_MES;
}
async function contar(env: MobileEmailEnv) {
  if (!env.MOBILE_DB) return;
  const mes = new Date().toISOString().slice(0, 7);
  await env.MOBILE_DB.prepare('INSERT INTO mobile_email_cota(mes, enviados) VALUES (?, 1) ON CONFLICT(mes) DO UPDATE SET enviados = enviados + 1').bind(mes).run();
}

export async function sendMobileAuthEmail(
  env: MobileEmailEnv,
  to: string,
  purpose: MobileEmailPurpose,
  token: string,
) {
  if (!mobileEmailConfigured(env)) return false;
  const { subject, text, html } = conteudo(purpose, mobileEmailLink(env, purpose, token));

  if (env.EMAIL && env.MOBILE_EMAIL_FILA !== '1' && await cotaDoMes(env).catch(() => false)) {
    try {
      await env.EMAIL.send({
        to,
        from: { email: env.MOBILE_EMAIL_FROM?.trim() || REMETENTE_PADRAO, name: 'Kartódromo de Betim' },
        subject,
        text,
        html,
      });
      await contar(env).catch(() => undefined);
      return true;
    } catch (e) {
      console.error('mobile email binding', (e as { code?: string }).code ?? '', (e as Error).message);
    }
  }
  if (env.MOBILE_EMAIL_FILA === '1' || !(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim())) {
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
    if (response.ok) return true;
  } catch {
    // Falha do provedor não pode descartar a mensagem antes de tentar a fila durável.
  }
  try { return await enfileirar(env, to, subject, text, html); }
  catch { console.error('mobile email outbox unavailable'); return false; }
}
