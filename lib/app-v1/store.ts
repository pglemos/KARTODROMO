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
  /** Sobe só se o que importa a comandos mudou; passagem de kart não muda a assinatura. */
  registrarAssinatura(sessionId: string, assinatura: string): number;
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
  id TEXT PRIMARY KEY, usuarioId TEXT NOT NULL REFERENCES usuarios(id), deviceId TEXT NOT NULL, refreshHash TEXT NOT NULL, refreshAnteriorHash TEXT, refreshAnteriorAte INTEGER,
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
CREATE TABLE IF NOT EXISTS karts_chassi (kart TEXT PRIMARY KEY, chassi TEXT NOT NULL, atualizadoPor TEXT NOT NULL, atualizadoEm TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS karts_fora (kart TEXT PRIMARY KEY, motivo TEXT NOT NULL, usuario TEXT NOT NULL, em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS abertura_frota (
  dia TEXT NOT NULL, kart TEXT NOT NULL, itens TEXT NOT NULL, conferidoPor TEXT NOT NULL, conferidoEm TEXT NOT NULL,
  aceitoPor TEXT, aceitoEm TEXT, excecao TEXT, PRIMARY KEY (dia, kart)
);
CREATE TRIGGER IF NOT EXISTS abertura_invalida_oficina AFTER INSERT ON karts_fora
BEGIN DELETE FROM abertura_frota WHERE kart = NEW.kart; END;
CREATE TABLE IF NOT EXISTS escala_abertura (dia TEXT PRIMARY KEY, operador TEXT NOT NULL, atualizadoPor TEXT NOT NULL, atualizadoEm TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tempos_galpao (
  bateria TEXT PRIMARY KEY, iniciadoEm TEXT NOT NULL, concluidoEm TEXT, quantidadeKarts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lastros_conferidos (sessionId TEXT NOT NULL, chave TEXT NOT NULL, kart TEXT NOT NULL, pesoKg REAL NOT NULL, usuario TEXT NOT NULL, em TEXT NOT NULL, PRIMARY KEY (sessionId, chave));
CREATE TABLE IF NOT EXISTS perfis_especiais (usuarioId TEXT PRIMARY KEY REFERENCES usuarios(id), perfil TEXT NOT NULL CHECK (perfil = 'EQUALIZACAO'));
CREATE TABLE IF NOT EXISTS karts_sem_teste (kart TEXT PRIMARY KEY, sessionId TEXT NOT NULL, autor TEXT NOT NULL, em TEXT NOT NULL, ajusteMm REAL);
CREATE TABLE IF NOT EXISTS aulas (id TEXT PRIMARY KEY, instrutor TEXT NOT NULL, pilotos INTEGER NOT NULL, aulas INTEGER NOT NULL, valorCentavos INTEGER NOT NULL, criadoEm TEXT NOT NULL, criadoPor TEXT NOT NULL, aceitoEm TEXT, aceitoPor TEXT);
CREATE TABLE IF NOT EXISTS ordens_servico (
  id TEXT PRIMARY KEY, kart TEXT NOT NULL, motivo TEXT NOT NULL, mecanico TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('aberta','em_execucao','concluida','cancelada')),
  criadaEm TEXT NOT NULL, criadaPor TEXT NOT NULL, atualizadaEm TEXT NOT NULL, atualizadaPor TEXT NOT NULL, observacao TEXT
);
CREATE TABLE IF NOT EXISTS revisoes (sessionId TEXT PRIMARY KEY, revisao INTEGER NOT NULL, assinatura TEXT);
`;

export function abrirStore(caminho: string, abrir: Abrir = abrirNativo): AppStore {
  let db: DatabaseSync;
  try {
    if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
    db = abrir(caminho);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 200;');
    db.exec(ESQUEMA);
    if (!(db.prepare('PRAGMA table_info(karts_sem_teste)').all() as { name: string }[]).some(c => c.name === 'ajusteMm')) db.exec('ALTER TABLE karts_sem_teste ADD COLUMN ajusteMm REAL');
    if (!(db.prepare('PRAGMA table_info(karts_fora)').all() as { name: string }[]).some(c => c.name === 'estado')) db.exec("ALTER TABLE karts_fora ADD COLUMN estado TEXT NOT NULL DEFAULT 'oficina' CHECK (estado IN ('oficina', 'equalizar'))");
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
    registrarAssinatura(sessionId, assinatura) {
      return (db.prepare(`INSERT INTO revisoes (sessionId, revisao, assinatura) VALUES (?, 1, ?)
        ON CONFLICT(sessionId) DO UPDATE SET revisao = revisao + 1, assinatura = excluded.assinatura
        WHERE revisoes.assinatura IS NOT excluded.assinatura RETURNING revisao`).get(sessionId, assinatura) as { revisao: number } | undefined)?.revisao ?? this.revisao(sessionId);
    },
    fechar() { db.close(); },
  };
}
