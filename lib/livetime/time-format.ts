export type DurationFormatOptions = {
  totalMinutes?: boolean;
};

function clockDurationMs(hours: number, minutes: number, seconds: number, fraction = ''): number {
  const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3) || 0);
  return hours * 60 * 60 * 1_000 + minutes * 60 * 1_000 + seconds * 1_000 + milliseconds;
}

function numericDurationMs(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  // SQL Server TIME values can arrive from mssql as 100-nanosecond ticks.
  return Math.round(value >= 10_000_000_000 ? value / 10_000 : value);
}

export function parseDurationMs(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return numericDurationMs(value);

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : clockDurationMs(value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), String(value.getUTCMilliseconds()));
  }

  const raw = String(value).trim().replace(/^\+/, '');
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return numericDurationMs(Number(raw));

  const isoMatch = raw.match(/T(?<hours>\d{1,2}):(?<minutes>\d{2}):(?<seconds>\d{2})(?:[.,](?<fraction>\d{1,7}))?/);
  const hmsMatch = raw.match(/^(?<hours>\d+):(?<minutes>\d{2}):(?<seconds>\d{2})(?:[.,](?<fraction>\d{1,7}))?/);
  const minutesMatch = raw.match(/^(?<minutes>\d+):(?<seconds>\d{2})(?:[.,](?<fraction>\d{1,7}))?/);
  const match = isoMatch || hmsMatch || minutesMatch;
  if (!match?.groups) return null;

  return clockDurationMs(
    Number(match.groups.hours || 0),
    Number(match.groups.minutes || 0),
    Number(match.groups.seconds || 0),
    match.groups.fraction || '',
  );
}

export function formatDurationMs(milliseconds: number, options: DurationFormatOptions = {}): string | null {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;

  const total = Math.round(milliseconds);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;

  if (options.totalMinutes) {
    const totalMinutes = Math.floor(total / 60_000);
    return `${totalMinutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  const hours = Math.floor(total / 3_600_000);
  if (hours > 0) {
    const minutes = Math.floor((total % 3_600_000) / 60_000);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  return `${Math.floor(total / 60_000)}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
