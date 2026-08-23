import type { HistoryWindow, KartHistoryItem, KartHistorySummary } from '@/src/admin/modules/equalizacao/equalizacao.types';

export type KartHistoryWindows = Record<'7' | '15' | '30' | '60', HistoryWindow>;

function bestLapInRows(rows: ReadonlyArray<KartHistoryItem>, predicate?: (row: KartHistoryItem) => boolean): number | null {
  const values = rows
    .filter((row) => row.bestLapMs !== null && (!predicate || predicate(row)))
    .map((row) => row.bestLapMs as number);
  return values.length ? Math.min(...values) : null;
}

function isInRollingWindow(row: KartHistoryItem, nowMs: number, days: number): boolean {
  const dateMs = new Date(row.raceDate).getTime();
  return Number.isFinite(dateMs) && dateMs <= nowMs && dateMs >= nowMs - days * 24 * 60 * 60 * 1_000;
}

/** Summarizes real race history using calendar/rolling date windows, not row counts. */
export function buildKartHistorySummary(
  rows: ReadonlyArray<KartHistoryItem>,
  now = new Date(),
): KartHistorySummary | null {
  const usableRows = rows.filter((row) => row.bestLapMs !== null);
  if (!usableRows.length) return null;

  const averageValues = usableRows
    .map((row) => row.averageLapMs ?? row.bestLapMs)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const averageLapMs = averageValues.length
    ? Math.round(averageValues.reduce((total, value) => total + value, 0) / averageValues.length)
    : null;
  const deviationMs = averageValues.length && averageLapMs !== null
    ? Math.round(Math.sqrt(averageValues.reduce((total, value) => total + (value - averageLapMs) ** 2, 0) / averageValues.length))
    : null;
  const nowMs = now.getTime();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const isInCurrentMonth = (row: KartHistoryItem) => {
    const date = new Date(row.raceDate);
    return Number.isFinite(date.getTime()) && date.getUTCFullYear() === year && date.getUTCMonth() === month;
  };
  const lastRaceDate = usableRows
    .map((row) => row.raceDate)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;

  return {
    plate: usableRows[0].plate || '',
    matchedBy: usableRows[0].matchedBy,
    raceCount: usableRows.length,
    bestLapMs: bestLapInRows(usableRows),
    averageLapMs,
    deviationMs,
    bestMonthMs: bestLapInRows(usableRows, isInCurrentMonth),
    best15DaysMs: bestLapInRows(usableRows, (row) => isInRollingWindow(row, nowMs, 15)),
    best7DaysMs: bestLapInRows(usableRows, (row) => isInRollingWindow(row, nowMs, 7)),
    lastRaceDate,
  };
}

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
