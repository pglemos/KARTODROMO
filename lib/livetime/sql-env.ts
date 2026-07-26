import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export function getLaptimeSqlOptions(): LapTimeSqlOptions | null {
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

export function getMirrorSqlOptions(): LapTimeSqlOptions | null {
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
    timeoutMs: Number(process.env.SRVKART_SQL_TIMEOUT_MS || '5000'),
  };
}

export function getCalXProSqlOptions(): LapTimeSqlOptions | null {
  const server = process.env.CALXPRO_SQL_SERVER;
  if (!server) return null;

  return {
    server,
    database: process.env.CALXPRO_SQL_DATABASE || 'CALXPRO',
    user: process.env.CALXPRO_SQL_USER || '',
    password: process.env.CALXPRO_SQL_PASSWORD || '',
    instanceName: process.env.CALXPRO_SQL_INSTANCE,
    port: process.env.CALXPRO_SQL_PORT ? Number(process.env.CALXPRO_SQL_PORT) : undefined,
    timeoutMs: Number(process.env.CALXPRO_SQL_TIMEOUT_MS || '5000'),
  };
}
