const EMAIL = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;

/** Remove endereços de e-mail de logs operacionais sem alterar o conteúdo enviado ao SMTP. */
export function redigirEmails(texto: string): string {
  return String(texto).replace(EMAIL, '[email redigido]');
}
