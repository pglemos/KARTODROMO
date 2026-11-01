import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

/** Sem armazenamento transacional o módulo fica fora do ar. Nunca há alternativa em JSON. */
export class StoreIndisponivel extends Error {}

export interface AppStore {
  db: DatabaseSync;
  transacao<T>(fn: () => T): T;
  revisao(sessionId: string): number;
  subirRevisao(sessionId: string): number;
  fechar(): void;
}

type Abrir = (caminho: string) => DatabaseSync;

const abrirNativo: Abrir = (caminho) => {
  const sqlite = process.getBuiltinModule('node:sqlite');
  if (!sqlite) throw new Error('node:sqlite ausente');
  return new sqlite.DatabaseSync(caminho);
};

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, perfil TEXT NOT NULL CHECK (perfil IN ('RECEPCAO','OPERACAO','GERENCIA')),
  senhaHash TEXT NOT NULL, bloqueado INTEGER NOT NULL DEFAULT 0, falhas INTEGER NOT NULL DEFAULT 0, bloqueadoAte INTEGER NOT NULL DEFAULT 0, criadoEm TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessoes (
  id TEXT PRIMARY KEY, usuarioId TEXT NOT NULL REFERENCES usuarios(id), deviceId TEXT NOT NULL, refreshHash TEXT NOT NULL,
  expiraAbsolutoEm INTEGER NOT NULL, revogadaEm INTEGER, criadoEm INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS operacoes (
  operationId TEXT PRIMARY KEY, actorUserId TEXT NOT NULL, command TEXT NOT NULL, sessionId TEXT NOT NULL, payloadHash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPLIED','REJECTED','UNKNOWN')), resposta TEXT, criadoEm TEXT NOT NULL, atualizadoEm TEXT
);
CREATE TABLE IF NOT EXISTS auditoria (
  auditId TEXT PRIMARY KEY, operationId TEXT, actorUserId TEXT, actorRole TEXT, deviceId TEXT, sessionId TEXT, timestampServerUTC TEXT NOT NULL,
  routeMode TEXT, action TEXT NOT NULL, reason TEXT, before TEXT, after TEXT, status TEXT NOT NULL, requestHash TEXT, sourceSystem TEXT, legacyEventId TEXT, correlationId TEXT
);
CREATE TRIGGER IF NOT EXISTS auditoria_sem_update BEFORE UPDATE ON auditoria BEGIN SELECT RAISE(ABORT, 'auditoria somente insercao'); END;
CREATE TRIGGER IF NOT EXISTS auditoria_sem_delete BEFORE DELETE ON auditoria BEGIN SELECT RAISE(ABORT, 'auditoria somente insercao'); END;
CREATE TABLE IF NOT EXISTS revisoes (sessionId TEXT PRIMARY KEY, revisao INTEGER NOT NULL);
`;

export function abrirStore(caminho: string, abrir: Abrir = abrirNativo): AppStore {
  let db: DatabaseSync;
  try {
    if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
    db = abrir(caminho);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;');
    db.exec(ESQUEMA);
  } catch (err) {
    throw new StoreIndisponivel(`Armazenamento transacional indisponível: ${(err as Error).message}`);
  }
  let aberta = false;
  return {
    db,
    transacao(fn) {
      if (aberta) throw new Error('Transação aninhada não é permitida.');
      db.exec('BEGIN IMMEDIATE');
      aberta = true;
      try {
        const r = fn();
        db.exec('COMMIT');
        return r;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      } finally {
        aberta = false;
      }
    },
    revisao(sessionId) {
      return (db.prepare('SELECT revisao FROM revisoes WHERE sessionId = ?').get(sessionId) as { revisao: number } | undefined)?.revisao ?? 0;
    },
    subirRevisao(sessionId) {
      return (db.prepare(`INSERT INTO revisoes (sessionId, revisao) VALUES (?, 1)
        ON CONFLICT(sessionId) DO UPDATE SET revisao = revisao + 1 RETURNING revisao`).get(sessionId) as { revisao: number }).revisao;
    },
    fechar() { db.close(); },
  };
}
