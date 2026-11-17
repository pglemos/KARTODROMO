/** Binding `send_email`: envia por SMTP (EDGE_SMTP_URL, ex.: smtps://usuario:senha@mail.kartodromodebetim.com.br:465). */
import nodemailer from 'nodemailer';

interface Mensagem { to: string | string[]; from: string | { email: string; name?: string }; subject: string; text?: string; html?: string; replyTo?: string }

export class EnvioEmail {
  private transporte: ReturnType<typeof nodemailer.createTransport> | null = null;
  constructor(private readonly url: string | undefined, private readonly permitidos: string[] = []) {}

  async send(m: Mensagem | { from: string; to: string; raw: unknown }): Promise<{ messageId: string }> {
    if (!this.url) throw Object.assign(new Error('E-mail não configurado na VPS (EDGE_SMTP_URL)'), { code: 'E_NAO_CONFIGURADO' });
    this.transporte ??= nodemailer.createTransport(this.url);
    if ('raw' in m) {
      const raw = typeof m.raw === 'string' ? m.raw : await new Response(m.raw as BodyInit).text();
      const r = await this.transporte.sendMail({ envelope: { from: m.from, to: m.to }, raw });
      return { messageId: r.messageId };
    }
    const de = typeof m.from === 'string' ? { email: m.from } : m.from;
    if (this.permitidos.length && !this.permitidos.includes(de.email)) throw new Error(`remetente não permitido: ${de.email}`);
    const r = await this.transporte.sendMail({
      from: de.name ? { name: de.name, address: de.email } : de.email,
      to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo,
    });
    return { messageId: r.messageId };
  }
}
