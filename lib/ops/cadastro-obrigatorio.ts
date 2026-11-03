import { erroInstagramCliente } from './instagram';
/** Regras dos cadastros presenciais (recepção e totens), inclusive clientes antigos. */
export function erroPesoCliente(peso: unknown): string | null {
  const texto = String(peso ?? '').trim();
  if (!texto) return 'O peso é obrigatório. Informe o peso em kg.';
  const valor = Number(texto.replace(',', '.'));
  return Number.isFinite(valor) && valor >= 10 && valor <= 250
    ? null : 'Peso inválido. Informe um valor entre 10 e 250 kg.';
}

export function erroCadastroObrigatorio(dados: { email?: unknown; peso?: unknown; instagram?: unknown; semInstagram?: unknown }): string | null {
  const email = String(dados.email ?? '').trim();
  if (!email) return 'O e-mail é obrigatório.';
  if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'E-mail inválido. Informe um e-mail válido.';
  const erroPeso = erroPesoCliente(dados.peso);
  if (erroPeso) return erroPeso;
  if (dados.semInstagram === true || String(dados.semInstagram).toLowerCase() === 'true') {
    return null;
  }
  return erroInstagramCliente(dados.instagram);
}
