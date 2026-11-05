type Piloto = { name: string; kart: string; customerId?: string | null; autoAdded?: boolean };
type SessaoDia = { id: string; name: string; state: string; type?: string; createdAt: number; agendaId?: number | null; programaId?: string | null; groupId?: string | null; competitors: Piloto[] };
const real = (c: Piloto) => !c.autoAdded && c.name.trim() && c.name.trim().toLowerCase() !== `kart ${c.kart}`.toLowerCase();
const pessoa = (c: Piloto) => c.customerId ? `c:${c.customerId}` : `n:${c.name.trim().toLocaleLowerCase('pt-BR')}`;

/** Tomada e corrida pertencem à mesma bateria; a mesma pessoa conta só uma vez no dia. */
export function indicadoresDia(sessoes: SessaoDia[]) {
  const grupos = new Map<string, SessaoDia[]>();
  for (const s of sessoes) {
    const nome = s.name ?? '';
    const base = nome.replace(/\s*[·-]\s*(?:tomada(?:\s+de\s+tempo)?|classifica[cç][aã]o|corrida(?:\s+\d+)?|treino(?:\s+\d+)?).*$/i, '').trim().toLowerCase();
    const chave = s.agendaId != null ? `agenda-${s.agendaId}` : s.programaId ? `programa-${s.programaId}` : s.groupId ? `grupo-${s.groupId}` : base !== nome.trim().toLowerCase() && base ? `nome-${base}` : s.id;
    grupos.set(chave, [...(grupos.get(chave) ?? []), s]);
  }
  const viva = (s: SessaoDia) => s.state === 'em_andamento' || s.state === 'bandeira_final';
  const participou = (s: SessaoDia) => s.state === 'encerrada' || viva(s);
  const lista = [...grupos.values()];
  const estados = lista.map(g => {
    if (g.some(viva)) return 'emProva';
    const corridas = g.filter(s => s.type === 'corrida');
    if (corridas.length && corridas.every(s => s.state === 'encerrada')) return 'encerradas';
    return g.some(s => s.state === 'preparando') ? 'preparando' : 'encerradas';
  });
  return {
    baterias: {
      total: lista.length,
      emProva: estados.filter(e => e === 'emProva').length,
      encerradas: estados.filter(e => e === 'encerradas').length,
      preparando: estados.filter(e => e === 'preparando').length,
    },
    pilotos: new Set(sessoes.filter(participou).flatMap(s => s.competitors.filter(real).map(pessoa))).size,
    participacoes: lista.reduce((n, g) => n + new Set(g.filter(participou).flatMap(s => s.competitors.filter(real).map(pessoa))).size, 0),
  };
}
