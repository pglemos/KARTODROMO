type Bateria = { id: number; [key: string]: unknown };
type Inscricao = { id: number; bateriaId: number; pago: boolean | number; total: number };
type Grupo = { bateriaId: number; falta: number; pilotos: { inscricaoId: unknown }[] };
/** Um integrante de grupo entra apenas no saldo do grupo, inclusive quando pagou só o sinal. */
export function saldosDasBaterias<T extends Bateria>(baterias: T[], inscricoes: Inscricao[], grupos: Grupo[]) {
  const agrupadas = new Set(grupos.flatMap((g) => g.pilotos.map((p) => Number(p.inscricaoId))));
  const saldos = new Map<number, number>();
  for (const g of grupos) saldos.set(g.bateriaId, (saldos.get(g.bateriaId) ?? 0) + Math.max(0, Number(g.falta) || 0));
  for (const i of inscricoes) if (!i.pago && !agrupadas.has(i.id)) saldos.set(i.bateriaId, (saldos.get(i.bateriaId) ?? 0) + Math.max(0, Number(i.total) || 0));
  return baterias.map((b) => ({ ...b, saldoCentavos: saldos.get(b.id) ?? 0 }));
}
