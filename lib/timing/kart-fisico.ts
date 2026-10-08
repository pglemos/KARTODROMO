/**
 * Identidade física de karts e apuração de uso (horas de pista) para a oficina.
 */

import type { Competitor, Crossing, Session } from './race-engine';

/**
 * Retorna o número do kart físico em que a passagem realmente ocorreu.
 * Prioridade:
 * 1. originalKart (se a passagem veio de uma troca de kart anterior)
 * 2. Mapeamento do transponder físico (se mapa fornecido)
 * 3. Kart atual do competidor
 */
export function kartFisicoDaPassagem(
  c: Competitor,
  x: Crossing,
  mapa?: Record<string, string>,
): string | null {
  if (x.originalKart?.trim()) {
    return x.originalKart.trim();
  }
  if (mapa && x.transponder != null) {
    const raw = String(x.transponder);
    const mapped = mapa[raw];
    if (mapped?.trim()) return mapped.trim();
  }
  if (c.kart?.trim()) {
    return c.kart.trim();
  }
  return null;
}

/**
 * Calcula os minutos de uso de cada kart físico na bateria (da primeira à última passagem ativa).
 * Se um piloto trocou de kart (ex: do 4 para o 5), as passagens anteriores no kart 4 são creditadas
 * ao kart 4 e as passagens posteriores ao kart 5.
 */
export function usoKartsDaSessao(
  s: Session,
  mapa?: Record<string, string>,
): { kart: string; minutos: number }[] {
  const timestampsPorKart = new Map<string, number[]>();

  for (const c of s.competitors) {
    for (const x of c.crossings) {
      if (x.deleted) continue;
      const k = kartFisicoDaPassagem(c, x, mapa);
      if (!k) continue;
      let list = timestampsPorKart.get(k);
      if (!list) {
        list = [];
        timestampsPorKart.set(k, list);
      }
      list.push(x.wallMs);
    }
  }

  const result: { kart: string; minutos: number }[] = [];
  for (const [kart, timestamps] of timestampsPorKart.entries()) {
    if (timestamps.length < 2) continue;
    timestamps.sort((a, b) => a - b);
    const minutos = Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 60_000);
    if (minutos > 0) {
      result.push({ kart, minutos });
    }
  }

  result.sort((a, b) => {
    const numA = Number(a.kart);
    const numB = Number(b.kart);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
    return a.kart.localeCompare(b.kart);
  });

  return result;
}
