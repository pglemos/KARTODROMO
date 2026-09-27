/** Ranking por peso (RankingPeso do canvas): melhores voltas de cada piloto separadas por faixa de peso. Sem IO. */
import type { Session } from './race-engine';

export type OpcoesRanking = {
  top: number;
  /** AAAA-MM; vazio = todos os tempos (ou o período) */
  mes?: string | null;
  de?: string | null; // AAAA-MM-DD
  ate?: string | null;
  /** ignora voltas abaixo disso (corte de pista, passagem dupla) */
  minimoMs?: number | null;
  sexo?: 'M' | 'F' | null;
  /** limites das faixas em kg, ex.: [75, 90] → até 75 · de 75 a 90 · acima de 90 */
  faixas: number[];
  trackId?: string | null;
  categoria?: string | null;
  ignorarSegunda?: boolean;
};

export type DadosPiloto = { peso?: number | null; sexo?: string | null; email?: string | null; telefone?: string | null };
export type LinhaRanking = { posicao: number; nome: string; kart: string; melhorMs: number; data: string; bateria: string; pesoKg: number | null; sexo: string | null; contato: string | null };
export type FaixaRanking = { titulo: string; linhas: LinhaRanking[] };

const dia = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const diaSemana = (ms: number) => new Date(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay();
const chave = (c: { customerId?: string | null; name: string }) => (c.customerId ? 'c' + c.customerId : 'n' + c.name.trim().toLowerCase());

export function tituloFaixas(faixas: number[]) {
  const f = [...faixas].sort((a, b) => a - b);
  if (!f.length) return ['Todos os pesos'];
  const t = [`Até ${f[0]} kg`];
  for (let i = 1; i < f.length; i++) t.push(`De ${f[i - 1]} a ${f[i]} kg`);
  t.push(`Acima de ${f[f.length - 1]} kg`);
  return t;
}

function faixaDo(peso: number | null, faixas: number[]) {
  const f = [...faixas].sort((a, b) => a - b);
  if (!f.length) return 0;
  if (peso == null) return -1;
  for (let i = 0; i < f.length; i++) if (peso <= f[i]) return i;
  return f.length;
}

/**
 * Melhor volta de cada piloto (válida, acima do mínimo) nas baterias encerradas do período, agrupada por faixa de peso.
 * Pilotos sem peso cadastrado ficam numa faixa própria no fim quando há faixas.
 */
export function rankingPorPeso(sessoes: Iterable<Session>, dados: (customerId: string | null, nome: string) => DadosPiloto, o: OpcoesRanking, trackDe: (s: Session) => string | null = () => null): FaixaRanking[] {
  const melhores = new Map<string, LinhaRanking & { chave: string }>();
  for (const s of sessoes) {
    if (s.state !== 'encerrada') continue;
    const quando = s.startedAt ?? s.createdAt;
    const d = dia(quando);
    if (o.mes && d.slice(0, 7) !== o.mes) continue;
    if (o.de && d < o.de) continue;
    if (o.ate && d > o.ate) continue;
    if (o.ignorarSegunda && diaSemana(quando) === 1) continue;
    if (o.trackId && trackDe(s) !== o.trackId) continue;
    for (const c of s.competitors) {
      if (c.autoAdded || !c.name.trim() || c.name.trim().toLowerCase() === `kart ${c.kart}`.toLowerCase()) continue;
      if (c.detalhes?.oculto) continue;
      if (o.categoria && (c.category ?? '') !== o.categoria) continue;
      const voltas = c.crossings.filter((x) => !x.deleted && !x.invalid && x.lapMs != null && x.lapMs > 0 && (!o.minimoMs || x.lapMs >= o.minimoMs));
      if (!voltas.length) continue;
      const melhor = Math.min(...voltas.map((x) => x.lapMs as number));
      const k = chave(c);
      const atual = melhores.get(k);
      if (atual && atual.melhorMs <= melhor) continue;
      const info = dados(c.customerId ?? null, c.name);
      const peso = Number(c.detalhes?.peso) > 0 ? Number(c.detalhes?.peso) : info.peso ?? null;
      const sexo = (c.detalhes?.sexo as string | undefined) || info.sexo || null;
      melhores.set(k, { chave: k, posicao: 0, nome: c.name.trim(), kart: c.kart, melhorMs: melhor, data: d, bateria: s.name, pesoKg: peso && peso > 0 ? peso : null, sexo, contato: info.email || info.telefone || null });
    }
  }
  let lista = [...melhores.values()];
  if (o.sexo) lista = lista.filter((l) => (l.sexo ?? '').toUpperCase().startsWith(o.sexo!));
  const titulos = tituloFaixas(o.faixas);
  const grupos: FaixaRanking[] = titulos.map((t) => ({ titulo: t, linhas: [] }));
  const semPeso: FaixaRanking = { titulo: 'Sem peso cadastrado', linhas: [] };
  for (const l of lista) {
    const i = faixaDo(l.pesoKg, o.faixas);
    (i < 0 ? semPeso : grupos[i]).linhas.push(l);
  }
  const top = Math.max(1, Math.min(500, o.top || 10));
  for (const g of [...grupos, semPeso]) {
    g.linhas.sort((a, b) => a.melhorMs - b.melhorMs);
    g.linhas = g.linhas.slice(0, top).map((l, i) => { const { chave: _, ...resto } = l as LinhaRanking & { chave?: string }; return { ...resto, posicao: i + 1 }; });
  }
  return semPeso.linhas.length ? [...grupos, semPeso] : grupos;
}
