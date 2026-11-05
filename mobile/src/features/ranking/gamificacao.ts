/**
 * XP, categoria e conquistas do piloto, calculados no app a partir da carreira real (contagens de baterias,
 * corridas, vitórias, pódios, poles e voltas mais rápidas que o SRVKART publica). As regras ficam aqui e são as
 * mesmas explicadas na tela "Como funciona o ranking".
 */
import type { CarreiraPiloto } from './api';

export const XP_REGRAS = { bateria: 50, podio: 50, vitoria: 100, pole: 50, voltaMaisRapida: 50 } as const;

export type CategoriaPiloto = 'NOVATO' | 'AMADOR' | 'SEMI-PRO' | 'PROFISSIONAL' | 'LENDA';

/** a partir de quanto XP cada categoria começa (em ordem) */
export const CATEGORIAS: { nome: CategoriaPiloto; desde: number; cor: string }[] = [
  { nome: 'NOVATO', desde: 0, cor: '#9CA3AF' },
  { nome: 'AMADOR', desde: 500, cor: '#00E676' },
  { nome: 'SEMI-PRO', desde: 1500, cor: '#3B82F6' },
  { nome: 'PROFISSIONAL', desde: 4000, cor: '#8B5CF6' },
  { nome: 'LENDA', desde: 10000, cor: '#F59E0B' },
];

export function xpDe(c: Pick<CarreiraPiloto, 'baterias' | 'podios' | 'vitorias' | 'poles' | 'voltasMaisRapidas'>) {
  return c.baterias * XP_REGRAS.bateria + c.podios * XP_REGRAS.podio + c.vitorias * XP_REGRAS.vitoria
    + c.poles * XP_REGRAS.pole + c.voltasMaisRapidas * XP_REGRAS.voltaMaisRapida;
}

export function categoriaDe(xp: number) {
  let atual = CATEGORIAS[0];
  for (const c of CATEGORIAS) if (xp >= c.desde) atual = c;
  const proxima = CATEGORIAS[CATEGORIAS.indexOf(atual) + 1] ?? null;
  const progresso = proxima ? (xp - atual.desde) / (proxima.desde - atual.desde) : 1;
  return { ...atual, proxima, progresso: Math.max(0, Math.min(1, progresso)) };
}

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  icone: 'flag' | 'trophy' | 'medal' | 'bolt' | 'target' | 'fire' | 'crown' | 'star';
  cor: string;
  /** seção na tela de conquistas */
  grupo: 'Experiência' | 'Desempenho' | 'Vitórias' | 'Especiais';
  atual: number;
  meta: number;
  liberada: boolean;
}

export function conquistasDe(c: CarreiraPiloto): Conquista[] {
  const melhorGeral = Math.min(...c.tracados.map((t) => t.geral?.pos ?? Infinity));
  const e = c.estatisticas;
  const xp = xpDe(c);
  const desde = (nome: CategoriaPiloto) => CATEGORIAS.find((x) => x.nome === nome)?.desde ?? 1;
  const lista: Omit<Conquista, 'liberada'>[] = [
    // experiência: presença na pista e categorias
    { grupo: 'Experiência', id: 'estreia', nome: 'Estreia', descricao: 'Andou a primeira bateria', icone: 'flag', cor: '#3B82F6', atual: c.baterias, meta: 1 },
    { grupo: 'Experiência', id: 'frequente', nome: 'Frequente', descricao: '10 baterias na pista', icone: 'fire', cor: '#F97316', atual: c.baterias, meta: 10 },
    { grupo: 'Experiência', id: 'veterano', nome: 'Veterano', descricao: '50 baterias na pista', icone: 'star', cor: '#C0C7D1', atual: c.baterias, meta: 50 },
    { grupo: 'Experiência', id: 'centuriao', nome: 'Centurião', descricao: '100 baterias na pista', icone: 'star', cor: '#F59E0B', atual: c.baterias, meta: 100 },
    { grupo: 'Experiência', id: 'lenda', nome: 'Lenda da pista', descricao: '500 baterias na pista', icone: 'crown', cor: '#EF4444', atual: c.baterias, meta: 500 },
    { grupo: 'Experiência', id: 'amador', nome: 'Amador', descricao: 'Chegou à categoria AMADOR', icone: 'star', cor: '#00E676', atual: xp, meta: desde('AMADOR') },
    { grupo: 'Experiência', id: 'semipro', nome: 'Semi-pro', descricao: 'Chegou à categoria SEMI-PRO', icone: 'star', cor: '#3B82F6', atual: xp, meta: desde('SEMI-PRO') },
    { grupo: 'Experiência', id: 'pro', nome: 'Profissional', descricao: 'Chegou à categoria PROFISSIONAL', icone: 'trophy', cor: '#8B5CF6', atual: xp, meta: desde('PROFISSIONAL') },
    { grupo: 'Experiência', id: 'categoria-lenda', nome: 'Lenda', descricao: 'Chegou à categoria LENDA', icone: 'crown', cor: '#F59E0B', atual: xp, meta: desde('LENDA') },
    // desempenho: tempo de volta e tomada de tempo
    { grupo: 'Desempenho', id: 'pole', nome: 'Pole', descricao: 'Primeiro lugar numa tomada de tempo', icone: 'target', cor: '#00E676', atual: c.poles, meta: 1 },
    { grupo: 'Desempenho', id: 'poles3', nome: 'Mestre da pole', descricao: '3 poles em tomada de tempo', icone: 'target', cor: '#22C55E', atual: c.poles, meta: 3 },
    { grupo: 'Desempenho', id: 'relampago', nome: 'Relâmpago', descricao: 'Volta mais rápida de uma bateria', icone: 'bolt', cor: '#EC4899', atual: c.voltasMaisRapidas, meta: 1 },
    { grupo: 'Desempenho', id: 'relampago5', nome: 'Raio', descricao: '5 voltas mais rápidas', icone: 'bolt', cor: '#A855F7', atual: c.voltasMaisRapidas, meta: 5 },
    { grupo: 'Desempenho', id: 'top10', nome: 'Top 10', descricao: 'Entre os 10 melhores tempos de um traçado (geral)', icone: 'crown', cor: '#F59E0B', atual: Number.isFinite(melhorGeral) && melhorGeral <= 10 ? 1 : 0, meta: 1 },
    { grupo: 'Desempenho', id: 'recordista', nome: 'Recordista', descricao: 'Melhor tempo geral de um traçado', icone: 'crown', cor: '#EF4444', atual: melhorGeral === 1 ? 1 : 0, meta: 1 },
    // vitórias em corrida
    { grupo: 'Vitórias', id: 'podio', nome: 'Pódio', descricao: 'Primeiro pódio em corrida', icone: 'medal', cor: '#CD7F32', atual: c.podios, meta: 1 },
    { grupo: 'Vitórias', id: 'podios10', nome: 'Rei do pódio', descricao: '10 pódios em corrida', icone: 'medal', cor: '#F97316', atual: c.podios, meta: 10 },
    { grupo: 'Vitórias', id: 'vitoria', nome: 'Primeira vitória', descricao: 'Venceu uma corrida', icone: 'trophy', cor: '#F59E0B', atual: c.vitorias, meta: 1 },
    { grupo: 'Vitórias', id: 'campeao', nome: 'Colecionador', descricao: '10 vitórias em corrida', icone: 'crown', cor: '#8B5CF6', atual: c.vitorias, meta: 10 },
    { grupo: 'Vitórias', id: 'hattrick', nome: 'Hat trick', descricao: '3 vitórias seguidas em corrida', icone: 'fire', cor: '#EF4444', atual: e?.maiorSequenciaVitorias ?? 0, meta: 3 },
    { grupo: 'Vitórias', id: 'grid-cheio', nome: 'Grid cheio', descricao: 'Venceu uma corrida com 10 ou mais pilotos', icone: 'trophy', cor: '#06B6D4', atual: e?.cheias.vitorias ?? 0, meta: 1 },
    // especiais
    { grupo: 'Especiais', id: 'noturno', nome: 'Corredor noturno', descricao: '10 baterias depois das 18h', icone: 'star', cor: '#6366F1', atual: e?.noturnas ?? 0, meta: 10 },
    { grupo: 'Especiais', id: 'chuva', nome: 'Mestre da chuva', descricao: '3 vitórias em corrida na chuva', icone: 'bolt', cor: '#0EA5E9', atual: e?.vitoriasChuva ?? 0, meta: 3 },
    { grupo: 'Especiais', id: 'explorador', nome: 'Explorador', descricao: 'Correu em 3 traçados diferentes', icone: 'flag', cor: '#06B6D4', atual: e?.tracadosDiferentes ?? c.tracados.length, meta: 3 },
    { grupo: 'Especiais', id: 'fiel', nome: 'Piloto da casa', descricao: '1 ano desde a primeira bateria', icone: 'fire', cor: '#EC4899', atual: c.primeira ? Math.floor((Date.now() - Date.parse(c.primeira)) / 86_400_000) : 0, meta: 365 },
  ];
  return lista.map((x) => ({ ...x, atual: Math.min(x.atual, x.meta), liberada: x.atual >= x.meta }));
}

/** "Bernardo Nogueira Pitangueira Mendes" → "BM" */
export function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

/** "GABRIEL DANTAS" → "Gabriel Dantas" (nomes da crono às vezes vêm em caixa alta) */
export function nomeBonito(nome: string) {
  const minusc = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return nome.trim().toLowerCase().split(/\s+/).map((w, i) => (i > 0 && minusc.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
