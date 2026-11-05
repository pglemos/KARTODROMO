/** Quem veio da agenda da recepção e não está mais nela (movido de horário ou cancelado). */
export function quemSaiuDaAgenda<C extends { name: string; customerId?: string | null }>(puxados: string[], competidores: C[], naAgenda: Set<string>) {
  const chaves = new Set(puxados.filter((k) => !naAgenda.has(k)));
  return {
    chaves,
    competidores: competidores.filter((c) => chaves.has(String(c.customerId ?? c.name.trim().toLowerCase()))),
  };
}
