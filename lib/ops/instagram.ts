/** Aceita o @usuário ou o link de perfil; guarda sempre o identificador canônico. */
export function normalizarInstagram(value: unknown): string {
  let usuario = String(value ?? '').trim();
  const perfil = usuario.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (perfil) usuario = perfil[1];
  usuario = usuario.replace(/^@/, '').toLowerCase();
  return usuario ? '@' + usuario : '';
}

export function erroInstagramCliente(value: unknown): string | null {
  if (!String(value ?? '').trim()) return 'O Instagram é obrigatório. Informe o @usuário do piloto.';
  const perfil = normalizarInstagram(value);
  return /^@[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(perfil) && !perfil.includes('..')
    ? null : 'Instagram inválido. Informe o @usuário do piloto (ex.: @andre.silva).';
}
