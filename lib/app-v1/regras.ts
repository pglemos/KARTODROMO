/** Regras do sorteio sem IO: elegibilidade (docs/app-operacional/ELEGIBILIDADE.md) e lastro (APK 1.6, função X1.b.o). */
export type Inscricao = { clienteId: unknown; nome: string; aprovada: unknown; pago: unknown; termo: unknown; totalCentavos: unknown; endurance: unknown };
export type Elegibilidade = { situacao: 'ELEGIVEL' | 'INELEGIVEL' | 'INDETERMINADA'; motivo: string | null };

const verdade = (v: unknown) => v === true || v === 1;
const conhecido = (v: unknown) => v === true || v === false || v === 0 || v === 1;

export function elegibilidade(i: Inscricao): Elegibilidade {
  if (![i.aprovada, i.pago, i.termo, i.endurance].every(conhecido) || typeof i.totalCentavos !== 'number') return { situacao: 'INDETERMINADA', motivo: 'Situação desconhecida: confira na recepção.' };
  if (!verdade(i.aprovada)) return { situacao: 'INELEGIVEL', motivo: 'Não aprovado na recepção.' };
  if (!verdade(i.termo)) return { situacao: 'INELEGIVEL', motivo: 'Sem termo: imprimir na recepção.' };
  if (!verdade(i.pago) && !verdade(i.endurance) && i.totalCentavos > 0) return { situacao: 'INELEGIVEL', motivo: 'Pagamento pendente.' };
  return { situacao: 'ELEGIVEL', motivo: null };
}

export type Frota = 'LIGHT' | 'SUPER';
export const META_KG: Record<Frota, number> = { LIGHT: 90, SUPER: 100 };
export const frotaDoKart = (kart: string): Frota | null => {
  const n = Number(kart);
  if (!Number.isInteger(n) || n < 1) return null;
  return n <= 99 ? 'LIGHT' : 'SUPER';
};

export function planoLastro(pesoKg: number, frota: Frota) {
  const meta = META_KG[frota];
  const unidades = Math.max(0, Math.ceil(Math.max(0, meta - pesoKg) / 2.5 - 1e-7));
  const lastroKg = unidades * 2.5;
  return { pesoKg, metaKg: meta, lastroKg, pecas5: Math.floor(unidades / 2), pecas2_5: unidades % 2, finalKg: pesoKg + lastroKg };
}
export const pesoValido = (p: unknown): p is number => typeof p === 'number' && Number.isFinite(p) && p >= 20 && p <= 250;
