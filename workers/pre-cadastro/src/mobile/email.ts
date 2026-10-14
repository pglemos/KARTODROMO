export interface MobileEmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export type MobileEmailPurpose = 'verify' | 'reset';

export function mobileEmailConfigured(env: MobileEmailEnv) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}

export async function sendMobileAuthEmail(
  env: MobileEmailEnv,
  to: string,
  purpose: MobileEmailPurpose,
  token: string,
) {
  if (!mobileEmailConfigured(env)) return false;

  const path = purpose === 'verify' ? 'verificar-email' : 'redefinir-senha';
  const link = `kartodromo://${path}?token=${encodeURIComponent(token)}`;
  const isVerification = purpose === 'verify';
  const subject = isVerification ? 'Confirme seu e-mail' : 'Redefina sua senha';
  const action = isVerification ? 'confirmar seu e-mail' : 'criar uma nova senha';
  const htmlLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [to],
        subject,
        text: `Use este link para ${action}: ${link}`,
        html: `<p>Use este link para ${action}:</p><p><a href="${htmlLink}">${subject}</a></p><p>O link expira em 30 minutos.</p>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
