import type { LiveTimingSnapshot } from '@/lib/livetime/types';

export type LiveTimingTeamRow = {
  position: number;
  kart: string;
  team: string;
};

export function normalizeKart(value: string | number | undefined): string {
  return String(value ?? '').trim().replace(/^#/, '').trim();
}

export function mergeTeamRows(snapshot: LiveTimingSnapshot, rows: LiveTimingTeamRow[]): LiveTimingSnapshot {
  if (!rows.length || !snapshot.drivers.length) return snapshot;

  const byKart = new Map(rows.filter((row) => normalizeKart(row.kart)).map((row) => [normalizeKart(row.kart), row.team.trim()]));
  const byPosition = new Map(rows.filter((row) => row.position > 0).map((row) => [row.position, row.team.trim()]));
  let changed = false;

  const drivers = snapshot.drivers.map((driver) => {
    const team = byKart.get(normalizeKart(driver.kart)) || byPosition.get(driver.position) || driver.team || '';
    if (!team || team === driver.team) return driver;
    changed = true;
    return { ...driver, team };
  });

  return changed ? { ...snapshot, drivers } : snapshot;
}
