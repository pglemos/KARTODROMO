export type ReceptionTimingSession = {
  id: string;
  name?: string;
  type?: string;
  state?: string;
  createdAt?: number | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  agendaId?: number | null;
  competitors?: number;
};

export const CRONOMETRAGEM_REPORT_TYPES = [
  { slug: 'resultados_oficiais', label: 'Resultado oficial' },
  { slug: 'sem_velocidade', label: 'Resultado oficial · sem velocidade média' },
  { slug: 'com_tempo_medio', label: 'Resultado oficial · com tempo médio' },
  { slug: 'ordem_chegada', label: 'Ordem de chegada' },
  { slug: 'ordem_chegada_categoria', label: 'Ordem de chegada · por categoria' },
  { slug: 'passagens', label: 'Relatório de passagens' },
  { slug: 'volta_a_volta', label: 'Volta a volta · todos' },
  { slug: 'mapa_voltas', label: 'Mapa de voltas · todos' },
  { slug: 'mapa_prova', label: 'Mapa de prova' },
  { slug: 'grid_2col_esq', label: 'Grid · 2 colunas · líder à esquerda' },
  { slug: 'grid_2col_dir', label: 'Grid · 2 colunas · líder à direita' },
  { slug: 'grid_3col_esq', label: 'Grid · 3 colunas · líder à esquerda' },
  { slug: 'grid_3col_dir', label: 'Grid · 3 colunas · líder à direita' },
] as const;

/** Usa o início quando existe; para sessões antigas/encerradas sem início, usa fim e depois criação. */
export function sessaoDataReferencia(session: ReceptionTimingSession): number | null {
  for (const value of [session.startedAt, session.finishedAt, session.createdAt]) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function dataLocalIso(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selecionarSessoesParaRelatorio(
  sessions: ReceptionTimingSession[],
  de?: string,
  ate?: string,
): ReceptionTimingSession[] {
  return sessions
    .filter((session) => session.state !== 'cancelada')
    .filter((session) => {
      const timestamp = sessaoDataReferencia(session);
      if (timestamp == null) return false;
      const date = dataLocalIso(timestamp);
      return (!de || date >= de) && (!ate || date <= ate);
    })
    .sort((a, b) => (sessaoDataReferencia(b) ?? 0) - (sessaoDataReferencia(a) ?? 0));
}

export function urlRelatorioCronometragem(baseUrl: string, sessionId: string, tipo: string): string {
  const reportType = CRONOMETRAGEM_REPORT_TYPES.some((item) => item.slug === tipo) ? tipo : 'resultados_oficiais';
  return `${baseUrl.replace(/\/$/, '')}/resultado/${encodeURIComponent(sessionId)}?tipo=${encodeURIComponent(reportType)}`;
}
