// Índice de pilotos UDK para vincular entradas do LapTime.
// Ordem de resolução: kart exato primeiro; fallback por nome normalizado com
// score de similaridade e confiança mínima configurável. Sem match → null.
import type { LapTimeCompetitorRow } from '@/lib/udk-bridge/types';

export type UdkDriverRow = {
  id: string;
  number: number | null;
  name: string | null;
};

export type DriverResolve =
  | { id: string; via: 'kart' | 'name'; score: number }
  | { id: null; via: 'none'; score: 0 };

// Normaliza um nome para comparação: minúsculas, sem acentos, sem pontuação.
export function normalizeDriverName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(value: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) grams.add(value.slice(i, i + 2));
  return grams;
}

// Similaridade 0..1 entre dois nomes. Combina:
// - Dice sobre bigramas (tolerante a pequenas variações);
// - Cobertura de tokens: quando um nome é subconjunto do outro (ex.: nome
//   curto do LapTime dentro do nome completo do UDK) o score é alto.
export function nameSimilarity(a: string, b: string): number {
  const left = normalizeDriverName(a);
  const right = normalizeDriverName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const tokensA = new Set(left.split(' '));
  const tokensB = new Set(right.split(' '));
  let sharedTokens = 0;
  for (const token of tokensA) if (tokensB.has(token)) sharedTokens += 1;
  const coverage = sharedTokens / Math.min(tokensA.size, tokensB.size);

  const gramsA = bigrams(left);
  const gramsB = bigrams(right);
  let sharedGrams = 0;
  for (const gram of gramsA) if (gramsB.has(gram)) sharedGrams += 1;
  const dice = (2 * sharedGrams) / (gramsA.size + gramsB.size || 1);

  return Math.max(dice, coverage);
}

export class DriverMatchIndex {
  readonly byNumber: Map<number, string>;
  private readonly byNormalizedName: Map<string, string>;
  private readonly named: Array<{ id: string; name: string }>;

  constructor(drivers: UdkDriverRow[]) {
    this.byNumber = new Map();
    this.byNormalizedName = new Map();
    this.named = [];
    for (const driver of drivers) {
      if (driver.number != null && !this.byNumber.has(driver.number)) {
        this.byNumber.set(driver.number, driver.id);
      }
      if (driver.name) {
        const normalized = normalizeDriverName(driver.name);
        if (normalized) {
          if (!this.byNormalizedName.has(normalized)) this.byNormalizedName.set(normalized, driver.id);
          this.named.push({ id: driver.id, name: normalized });
        }
      }
    }
  }

  get size(): number {
    return this.named.length;
  }

  resolve(
    kartNumber: number | null | undefined,
    lapName: string | null | undefined,
    minScore = 0.8,
  ): DriverResolve {
    if (kartNumber != null) {
      const id = this.byNumber.get(kartNumber);
      if (id) return { id, via: 'kart', score: 1 };
    }

    const name = normalizeDriverName(lapName || '');
    if (!name) return { id: null, via: 'none', score: 0 };

    const exact = this.byNormalizedName.get(name);
    if (exact) return { id: exact, via: 'name', score: 1 };

    // Melhor score acima do limiar. Empate de score → mais tokens compartilhados
    // (candidato mais específico); novo empate → nome mais curto.
    let best: { id: string; score: number; shared: number; length: number } | null = null;
    for (const driver of this.named) {
      const score = nameSimilarity(name, driver.name);
      if (score < minScore) continue;
      const tokensA = new Set(name.split(' '));
      const tokensB = new Set(driver.name.split(' '));
      let shared = 0;
      for (const token of tokensA) if (tokensB.has(token)) shared += 1;
      if (
        !best ||
        score > best.score ||
        (score === best.score && shared > best.shared) ||
        (score === best.score && shared === best.shared && driver.name.length < best.length)
      ) {
        best = { id: driver.id, score, shared, length: driver.name.length };
      }
    }
    return best ? { id: best.id, via: 'name', score: best.score } : { id: null, via: 'none', score: 0 };
  }
}

// Nome do competidor LapTime usado no fallback por nome.
// Prioriza o nome completo (Competitor); ShortName (sigla) é só fallback.
export function lapCompetitorName(competitor: LapTimeCompetitorRow): string {
  return competitor.Competitor?.trim() || competitor.ShortName?.trim() || '';
}