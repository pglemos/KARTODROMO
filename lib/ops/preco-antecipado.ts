/**
 * Preço do pagamento ANTECIPADO (site, WhatsApp, troca de serviço de reserva já paga).
 * Regra do kartódromo: toda bateria de locação normal sai pelo produto ANTECIPADO (R$ 145), menos Happy Hour (preço
 * próprio), campeonatos e eventos (ficam com o produto da própria bateria).
 * Env: OPS_ONLINE_PRODUTO (4 = ANTECIPADO), OPS_ONLINE_PRODUTOS_BATERIA (locação: 11,4,67), OPS_ONLINE_PRECO_PROPRIO (67 = HAPPY HOUR).
 */
export const configOnline = () => {
  const e = process.env;
  return {
    produtoVenda: Number(e.OPS_ONLINE_PRODUTO || 4),
    produtosBateria: String(e.OPS_ONLINE_PRODUTOS_BATERIA || '11,4,67').split(',').map(Number).filter((n) => n > 0),
    precoProprio: String(e.OPS_ONLINE_PRECO_PROPRIO ?? '67').split(',').map(Number).filter((n) => n > 0),
    primeiraVez: Object.fromEntries(String(e.OPS_ONLINE_PRIMEIRA_VEZ ?? '67:8990').split(',').map((par) => par.split(':').map(Number))
      .filter(([prod, preco]) => prod > 0 && Number.isSafeInteger(preco) && preco > 0)) as Record<number, number>,
    antecedenciaMin: Number(e.OPS_ONLINE_ANTECEDENCIA_MIN || 120),
    maxPilotos: Number(e.OPS_ONLINE_MAX || 10),
    prazoMin: Number(e.OPS_ONLINE_PRAZO_MIN || 15),
    diasAgenda: Number(e.OPS_ONLINE_DIAS || 500), // a agenda do ano seguinte inteiro abre em outubro
  };
};

/** Produto cobrado numa bateria: o da própria bateria (Happy Hour) ou o ANTECIPADO de sempre. */
export const produtoDaBateria = (produtoBateria: number | null | undefined, c = configOnline()) =>
  produtoBateria && c.precoProprio.includes(Number(produtoBateria)) ? Number(produtoBateria) : c.produtoVenda;

/**
 * Produto do pagamento antecipado numa bateria. null = sem regra (campeonato, eventos, SuperKart, treino...): fica o
 * produto da bateria. Campeonato é reconhecido pelo nome da bateria (as do Lotokart usam o produto de locação).
 */
export function produtoAntecipado(produtoBateria: number | null | undefined, nomeBateria: string | null | undefined, c = configOnline()): number | null {
  if (!produtoBateria || !c.produtosBateria.includes(Number(produtoBateria))) return null;
  if (/campeonato|evento/i.test(String(nomeBateria ?? ''))) return null;
  return produtoDaBateria(produtoBateria, c);
}
