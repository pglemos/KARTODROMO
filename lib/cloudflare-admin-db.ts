import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getLocalSQLiteDb, isLocalSQLiteAvailable } from '@/lib/local-sqlite-db';
import type { AdminD1Database } from '@/lib/admin-d1';

declare global {
  interface CloudflareEnv {
    KARTODROMO_ADMIN_DB?: AdminD1Database;
  }
}

/** Resolve the D1 binding in Workers and the compatible SQLite adapter in local development. */
export async function getCloudflareAdminDb(): Promise<AdminD1Database | null> {
  if (process.env.NODE_ENV !== 'production' && isLocalSQLiteAvailable()) {
    const localDb = getLocalSQLiteDb();
    if (localDb) return localDb;
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.KARTODROMO_ADMIN_DB ?? null;
  } catch {
    return null;
  }
}
