import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getLocalSQLiteDb, getProducaoSQLiteDb, isLocalSQLiteAvailable } from '@/lib/local-sqlite-db';
import type { AdminD1Database } from '@/lib/admin-d1';

declare global {
  interface CloudflareEnv {
    KARTODROMO_ADMIN_DB?: AdminD1Database;
  }
}

/** Resolve the D1 binding in Workers and the compatible SQLite adapter in local development. */
export async function getCloudflareAdminDb(): Promise<AdminD1Database | null> {
  // VPS (fora da Cloudflare): o mesmo arquivo SQLite do kart-edge
  if (process.env.KART_ADMIN_SQLITE) return getProducaoSQLiteDb(process.env.KART_ADMIN_SQLITE);
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
