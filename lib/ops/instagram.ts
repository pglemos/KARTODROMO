/** Aceita o @usuário ou o link de perfil; guarda sempre o identificador canônico. */
export function normalizarInstagram(value: unknown): string {
  let usuario = String(value ?? '').trim();
  const perfil = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (perfil) usuario = perfil[1];
  usuario = usuario.replace(/^@/, '').toLowerCase();
  return usuario ? '@' + usuario : '';
}

export function erroInstagramCliente(value: unknown): string | null {
  const usuario = String(value ?? '').trim();
  if (!usuario) return null;
  const perfil = normalizarInstagram(usuario);
  return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes('..')
    ? null : 'Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).';
}
