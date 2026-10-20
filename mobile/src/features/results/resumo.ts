import type { PersonalResult, PublicSessionResults } from './types';

/** Hora do nome da bateria ("BATERIA 17:25 · CORRIDA" → 1045); corrida depois da tomada do mesmo horário. */
function horaDoNome(name: string) {
  const m = /(\d{1,2}):(\d{2})/.exec(name);
  return (m ? Number(m[1]) * 60 + Number(m[2]) : -1) * 2 + (/corrida/i.test(name) ? 1 : 0);
}

/** Mais recentes primeiro: data e, no mesmo dia, a hora que está no nome da bateria. */
export function ordenarBaterias(list: PublicSessionResults[]) {
  return [...list].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || horaDoNome(b.eventName) - horaDoNome(a.eventName));
}

/** Resumo da carreira a partir dos resultados oficiais da conta. */
export function resumoCarreira(results: PersonalResult[]) {
  const voltas = results.map((r) => r.bestLapMs).filter((v): v is number => v !== null);
  return {
    baterias: results.length,
    vitorias: results.filter((r) => r.position === 1).length,
    podios: results.filter((r) => r.position <= 3).length,
    melhorVolta: voltas.length ? Math.min(...voltas) : null,
  };
}
