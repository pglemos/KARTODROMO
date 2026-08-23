/**
 * Local SQLite database adapter for Next.js dev mode.
 * Uses Node.js 22+ built-in `node:sqlite` module (no external packages needed).
 * Provides a D1-compatible interface as fallback when Cloudflare D1 is not available.
 */

import type { AdminD1Database, AdminD1Statement } from './admin-d1';
import path from 'path';
import fs from 'fs';

type NodeSqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => NodeSqliteStatement;
  close: () => void;
};

type NodeSqliteStatement = {
  all: (...params: unknown[]) => Record<string, unknown>[];
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
};

const DB_DIR = path.join(process.cwd(), '.tmp');
const DB_PATH = path.join(DB_DIR, 'kartodromo-local.db');

let _db: NodeSqliteDb | null = null;
let _initDone = false;

function getDb(): NodeSqliteDb {
  if (_db && _initDone) return _db;

  // Ensure .tmp directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Use Node.js built-in sqlite (Node 22.5+)
  const { DatabaseSync } = (eval('require')('node:sqlite')) as {
    DatabaseSync: new (path: string) => NodeSqliteDb;
  };

  const db = new DatabaseSync(DB_PATH);

  // Enable WAL mode and foreign keys
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  if (!_db) {
    _db = db;
    initSchema(db);
    _initDone = true;
  }

  return _db;
}

function initSchema(db: NodeSqliteDb) {
  const migrations = [
    '0001_admin_schema.sql',
    '0002_inventory_integrity.sql',
    '0003_comprehensive_seed.sql',
    '0004_schema_fixes_and_clube.sql',
    '0005_championship_registrations.sql',
    '0006_kart_equalizacao.sql',
    '0007_race_formats.sql',
    '0008_laptime_fleet_sync.sql',
    '0009_equalizacao_automatica.sql',
  ].map((f) => path.join(process.cwd(), 'migrations', 'd1', f));

  // Track applied migrations
  db.exec(`CREATE TABLE IF NOT EXISTS _local_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  for (const migFile of migrations) {
    if (!fs.existsSync(migFile)) continue;

    const migName = path.basename(migFile);
    const alreadyApplied = db.prepare('SELECT 1 FROM _local_migrations WHERE name = ?').get(migName);
    if (alreadyApplied) continue;

    try {
      const sql = fs.readFileSync(migFile, 'utf-8');
      db.exec(sql);
      db.prepare('INSERT OR IGNORE INTO _local_migrations (name) VALUES (?)').run(migName);
      console.log(`[local-sqlite] ✓ Applied migration: ${migName}`);
    } catch (err) {
      console.error(`[local-sqlite] ✗ Failed to apply migration ${migName}:`, err);
    }
  }
}

function createD1Statement(db: NodeSqliteDb, query: string, params: unknown[]): AdminD1Statement {
  const makeStatement = (boundParams: unknown[]): AdminD1Statement => ({
    bind: (...newParams: unknown[]) => makeStatement([...boundParams, ...newParams]),

    all: async <T extends Record<string, unknown> = Record<string, unknown>>() => {
      try {
        const stmt = db.prepare(query);
        const results = stmt.all(...boundParams) as T[];
        return { results };
      } catch (err) {
        console.error('[local-sqlite] all() error:', err instanceof Error ? err.message : err);
        console.error('[local-sqlite] Query:', query.slice(0, 200));
        throw err;
      }
    },

    first: async <T extends Record<string, unknown> = Record<string, unknown>>() => {
      try {
        const stmt = db.prepare(query);
        const result = stmt.get(...boundParams) as T | undefined;
        return result ?? null;
      } catch (err) {
        console.error('[local-sqlite] first() error:', err instanceof Error ? err.message : err);
        console.error('[local-sqlite] Query:', query.slice(0, 200));
        throw err;
      }
    },

    run: async () => {
      try {
        const stmt = db.prepare(query);
        const info = stmt.run(...boundParams);
        return { meta: { changes: Number(info.changes) } };
      } catch (err) {
        console.error('[local-sqlite] run() error:', err instanceof Error ? err.message : err);
        console.error('[local-sqlite] Query:', query.slice(0, 200));
        throw err;
      }
    },
  });

  return makeStatement(params);
}

let _available: boolean | null = null;

export function isLocalSQLiteAvailable(): boolean {
  if (_available !== null) return _available;
  try {
    require.resolve('node:sqlite');
    _available = true;
  } catch {
    // node:sqlite is a built-in, require.resolve might not work the same way
    // Check Node version instead
    const version = process.versions.node.split('.').map(Number);
    _available = version[0] >= 22;
  }
  return _available;
}

export function getLocalSQLiteDb(): AdminD1Database | null {
  try {
    const db = getDb();

    return {
      prepare: (query: string) => createD1Statement(db, query, []),

      batch: async (statements: AdminD1Statement[]) => {
        // Execute statements sequentially (simple approach for dev)
        const results: unknown[] = [];
        for (const stmt of statements) {
          results.push(await stmt.run());
        }
        return results;
      },
    };
  } catch (err) {
    console.error('[local-sqlite] Failed to initialize:', err instanceof Error ? err.message : err);
    return null;
  }
}
