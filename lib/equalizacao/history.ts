import type { HistoryWindow, KartHistoryItem } from '@/src/admin/modules/equalizacao/equalizacao.types';

export type KartHistoryWindows = Record<'7' | '15' | '30' | '60', HistoryWindow>;

export function buildKartHistoryWindows(rows: ReadonlyArray<KartHistoryItem>): KartHistoryWindows {
  const sizes = [7, 15, 30, 60] as const;
  return Object.fromEntries(
    sizes.map((size) => {
      const windowRows = rows.slice(0, size).filter((row) => row.bestLapMs !== null);
      const values = windowRows.map((row) => row.bestLapMs as number);
      const firstBestLapMs = values.length ? values[values.length - 1] : null;
      const lastBestLapMs = values[0] ?? null;
      const averageBestLapMs = values.length
        ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
        : null;
      return [
        String(size),
        {
          count: windowRows.length,
          bestLapMs: values.length ? Math.min(...values) : null,
          averageBestLapMs,
          firstBestLapMs,
          lastBestLapMs,
          trendMs: firstBestLapMs !== null && lastBestLapMs !== null ? lastBestLapMs - firstBestLapMs : null,
        },
      ];
    }),
  ) as KartHistoryWindows;
}
