import * as SQLite from 'expo-sqlite';

let database: Promise<SQLite.SQLiteDatabase> | null = null;

export function getGpsDatabase() {
  if (!database) {
    database = openGpsDatabase().catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}

async function openGpsDatabase() {
  const db = await SQLite.openDatabaseAsync('kartodromo-gps.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS gps_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS gps_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES gps_sessions(id) ON DELETE CASCADE,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS gps_points_session_time ON gps_points(session_id, timestamp);
    CREATE TABLE IF NOT EXISTS gps_laps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES gps_sessions(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      crossed_at INTEGER NOT NULL
    );
  `);
  return db;
}
