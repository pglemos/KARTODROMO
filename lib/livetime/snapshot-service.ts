import { createDemoSnapshot } from '@/lib/livetime/demo-data';
import { fetchLapTimeSqlSnapshot, type LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

function resolveExternalUrl(endpoint: string, uid: string): string {
  if (endpoint.includes('{uid}')) return endpoint.split('{uid}').join(encodeURIComponent(uid));
  const url = new URL(endpoint);
  url.searchParams.set('uid', uid);
  return url.toString();
}

function getSqlOptions(): LapTimeSqlOptions | null {
  const server = process.env.SRVKART_SQL_SERVER || process.env.LAPTIME_SQL_SERVER;
  if (!server) return null;

  return {
    server,
    database: process.env.SRVKART_SQL_DATABASE || process.env.LAPTIME_SQL_DATABASE || 'LapTimeMirror',
    user: process.env.SRVKART_SQL_USER || process.env.LAPTIME_SQL_USER || '',
    password: process.env.SRVKART_SQL_PASSWORD || process.env.LAPTIME_SQL_PASSWORD || '',
    instanceName: process.env.SRVKART_SQL_INSTANCE || process.env.LAPTIME_SQL_INSTANCE,
    port: process.env.SRVKART_SQL_PORT
      ? Number(process.env.SRVKART_SQL_PORT)
      : process.env.LAPTIME_SQL_PORT
        ? Number(process.env.LAPTIME_SQL_PORT)
        : undefined,
    timeoutMs: Number(process.env.LAPTIME_SQL_TIMEOUT_MS || process.env.LIVETIME_TIMEOUT_MS || '3000'),
  };
}

export async function fetchExternalSnapshot(uid: string): Promise<LiveTimingSnapshot> {
  // 1. Try external snapshot endpoint if configured (e.g. scraper process on 4010)
  const endpoint = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (endpoint) {
    const timeoutMs = Number(process.env.LIVETIME_TIMEOUT_MS || '3000');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(resolveExternalUrl(endpoint, uid), {
        cache: 'no-store',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return (await response.json()) as LiveTimingSnapshot;
      }
    } catch {
      // Fall through to direct SQL query if external endpoint is unavailable
    } finally {
      clearTimeout(timeout);
    }
  }

  // 2. Direct SQL Query if LAPTIME_SQL_SERVER or SRVKART_SQL_SERVER is configured
  const sqlOptions = getSqlOptions();
  if (sqlOptions && sqlOptions.user && sqlOptions.password) {
    try {
      const sqlSnapshot = await fetchLapTimeSqlSnapshot(sqlOptions);
      if (sqlSnapshot) {
        return sqlSnapshot;
      }
    } catch {
      // Fall through to demo snapshot on error
    }
  }

  // 3. Fallback to demo snapshot
  return createDemoSnapshot('LIVETIME_SNAPSHOT_ENDPOINT ou SQL LapTime nao disponivel');
}

