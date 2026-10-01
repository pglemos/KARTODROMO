/** Sorteio de karts para os pilotos de uma bateria (substitui o "LapTime Sorteio"). Sem IO. */
import type { Session } from './race-engine';

export type PilotoSorteio = { indice: number; nome: string; customerId: string | null; kartAtual: string; excecoes: string[] };
export type Atribuicao = { indice: number; kart: string };

export function descricaoModoSorteio(modo: string): string {
  if (modo === 'um-a-um') return 'um a um';
  if (modo === 'fiscal') return 'fiscal escolhe';
  return 'todos de uma vez';
}

const nome = (n: string | null | undefined) => String(n ?? '').trim().toLowerCase();
const dia = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/**
 * Karts que cada piloto já usou e que o sorteio deve evitar: nas outras baterias do mesmo evento
 * (quando a bateria é de um evento) ou nas outras baterias do mesmo dia (locação). As provas do
 * mesmo programa (tomada de tempo + corrida) usam o mesmo kart e não contam.
 */
export function pilotosDoSorteio(sessao: Session, todas: Iterable<Session>, mesmoPrograma: (a: Session, b: Session) => boolean): PilotoSorteio[] {
  const anteriores = [...todas].filter((s) =>
    s.id !== sessao.id &&
    s.state !== 'preparando' && s.state !== 'cancelada' &&
    !mesmoPrograma(sessao, s) &&
    (sessao.eventId ? s.eventId === sessao.eventId : dia(s.createdAt) === dia(sessao.createdAt)));
  return sessao.competitors
    .map((c, indice) => ({ c, indice }))
    .filter(({ c }) => !c.autoAdded && nome(c.name) && nome(c.name) !== `kart ${nome(c.kart)}`)
    .map(({ c, indice }) => {
      const cid = c.customerId ? String(c.customerId) : '';
      const usados = new Set<string>();
      for (const s of anteriores) for (const o of s.competitors) {
        if (!o.kart) continue;
        const mesmo = cid ? String(o.customerId ?? '') === cid : nome(o.name) === nome(c.name);
        if (mesmo) usados.add(o.kart);
      }
      return { indice, nome: c.name.trim(), customerId: cid || null, kartAtual: c.kart, excecoes: [...usados].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)) };
    });
}

/** Confere o resultado vindo do tablet antes de gravar: um kart por piloto, sem repetir, só karts cadastrados. */
export function validarSorteio(sessao: Session, atribuicoes: Atribuicao[], kartsCadastrados: Set<string>) {
  if (sessao.state !== 'preparando') throw new Error('Essa bateria já largou: o sorteio só vale antes da bandeira verde.');
  if (!Array.isArray(atribuicoes) || atribuicoes.length === 0) throw new Error('O sorteio veio vazio.');
  const vistos = new Set<string>();
  const indices = new Set<number>();
  for (const a of atribuicoes) {
    const kart = String(a?.kart ?? '').trim();
    const indice = Number(a?.indice);
    if (!Number.isInteger(indice) || !sessao.competitors[indice]) throw new Error('O sorteio tem um piloto que não está nessa bateria. Atualize a lista e sorteie de novo.');
    if (indices.has(indice)) throw new Error(`O piloto ${sessao.competitors[indice].name} aparece duas vezes no sorteio.`);
    if (!/^\d+$/.test(kart)) throw new Error(`Kart inválido no sorteio: "${kart}".`);
    if (!kartsCadastrados.has(kart)) throw new Error(`O kart ${kart} não tem transponder cadastrado na cronometragem.`);
    if (vistos.has(kart)) throw new Error(`O kart ${kart} saiu para dois pilotos.`);
    vistos.add(kart);
    indices.add(indice);
  }
}

/** Aplica o sorteio: o piloto sorteado recebe o kart; quem ficou fora do sorteio perde um kart que agora é de outro. */
export function competidoresComSorteio(sessao: Session, atribuicoes: Atribuicao[]) {
  const porIndice = new Map(atribuicoes.map((a) => [Number(a.indice), String(a.kart).trim()]));
  const sorteados = new Set(porIndice.values());
  return sessao.competitors.map((c, i) => ({
    kart: porIndice.get(i) ?? (sorteados.has(c.kart) ? '' : c.kart),
    name: c.name,
    customerId: c.customerId ?? null,
    category: c.category ?? null,
  }));
}
