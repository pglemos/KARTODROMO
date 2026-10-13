export const PAINEL_LED_PAGE_SIZE = 10;
export const PAINEL_LED_MAX_PAGE = 99;

/** Normaliza a página compartilhada do painel físico (0 = posições 1–10). */
export function normalizarPaginaPainel(value: unknown): number {
  const pagina = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;

  if (!Number.isInteger(pagina) || pagina < 0 || pagina > PAINEL_LED_MAX_PAGE) {
    throw new Error(`Página inválida: informe um índice inteiro entre 0 e ${PAINEL_LED_MAX_PAGE}.`);
  }

  return pagina;
}
