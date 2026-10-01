/* Regras puras compartilhadas pelo atalho de preenchimento do checkout. */
(function (root) {
  root.KartodromoCheckout = Object.freeze({
    paraAdicionar(disponiveis, idsNoCarrinho) {
      const ocupados = new Set([...idsNoCarrinho].map((id) => String(id)));
      return (disponiveis || []).filter((reserva) => reserva?.id != null && !ocupados.has(String(reserva.id)));
    },
  });
}(globalThis));
