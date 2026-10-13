/**
 * Kart FÍSICO de cada passagem. Depois de uma troca de kart o piloto leva as voltas para o kart novo, mas cada leitura
 * continua sendo do kart que passou na linha: a troca grava esse kart em `originalKart` (setCompetitors/assignCrossing).
 * Sem `originalKart` a passagem é do kart atual do competidor.
 */

import type { Competitor, Crossing, Session } from './race-engine';

export function kartFisicoDaPassagem(c: Competitor, x: Crossing): string {
  return String(x.originalKart ?? c.kart ?? '').trim();
}

/**
 * Minutos de pista de cada kart físico na bateria (da primeira à última passagem DELE). Antes, depois de uma troca,
 * o kart novo levava o tempo todo e o anterior ficava com zero.
 */
export function usoKartsDaSessao(s: Session): { kart: string; minutos: number }[] {
  const porKart = new Map<string, number>();
  for (const c of s.competitors) {
    const tempos = new Map<string, number[]>();
    for (const x of c.crossings) {
      if (x.deleted) continue;
      const k = kartFisicoDaPassagem(c, x);
      if (!k) continue;
      if (!tempos.has(k)) tempos.set(k, []);
      tempos.get(k)!.push(x.wallMs);
    }
    for (const [k, t] of tempos) {
      if (t.length < 2) continue;
      t.sort((a, b) => a - b);
      porKart.set(k, (porKart.get(k) ?? 0) + (t[t.length - 1] - t[0]));
    }
  }
  return [...porKart]
    .map(([kart, ms]) => ({ kart, minutos: Math.round(ms / 60_000) }))
    .filter((k) => k.minutos > 0);
}
