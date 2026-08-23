-- Equalizacao automatica: a tomada de tempo do LapTime e a unica fonte de tempos.
CREATE TABLE IF NOT EXISTS karts_equalizacao_sessoes (
  id TEXT PRIMARY KEY,
  racing_id TEXT NOT NULL,
  racing_name TEXT NOT NULL,
  racing_type TEXT,
  track_name TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada', 'cancelada')),
  fonte TEXT NOT NULL DEFAULT 'cronometragem',
  responsavel TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_karts_equalizacao_sessoes_racing
  ON karts_equalizacao_sessoes(racing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS karts_equalizacao_capturas (
  id TEXT PRIMARY KEY,
  sessao_id TEXT NOT NULL REFERENCES karts_equalizacao_sessoes(id) ON DELETE CASCADE,
  kart_id TEXT NOT NULL REFERENCES karts(id) ON DELETE CASCADE,
  racing_id TEXT NOT NULL,
  racing_competitor_id_antes TEXT NOT NULL,
  racing_competitor_id_depois TEXT,
  numero_kart TEXT NOT NULL,
  piloto_antes TEXT NOT NULL,
  piloto_depois TEXT,
  transponder_antes TEXT,
  transponder_depois TEXT,
  tempo_antes_ms INTEGER NOT NULL CHECK (tempo_antes_ms > 0),
  media_antes_ms INTEGER,
  desvio_antes_ms INTEGER,
  voltas_antes INTEGER NOT NULL DEFAULT 0 CHECK (voltas_antes >= 0),
  volta_antes INTEGER,
  capturado_antes_em TEXT NOT NULL,
  tempo_depois_ms INTEGER,
  media_depois_ms INTEGER,
  desvio_depois_ms INTEGER,
  voltas_depois INTEGER,
  volta_depois INTEGER,
  capturado_depois_em TEXT,
  status TEXT NOT NULL DEFAULT 'antes' CHECK (status IN ('antes', 'completa')),
  fonte TEXT NOT NULL DEFAULT 'cronometragem',
  responsavel TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sessao_id, kart_id)
);

CREATE INDEX IF NOT EXISTS idx_karts_equalizacao_capturas_sessao
  ON karts_equalizacao_capturas(sessao_id, created_at DESC);

ALTER TABLE karts_equalizacoes ADD COLUMN sessao_id TEXT;
ALTER TABLE karts_equalizacoes ADD COLUMN captura_id TEXT;
ALTER TABLE karts_equalizacoes ADD COLUMN racing_id TEXT;
ALTER TABLE karts_equalizacoes ADD COLUMN racing_competitor_id TEXT;
ALTER TABLE karts_equalizacoes ADD COLUMN fonte TEXT NOT NULL DEFAULT 'manual_legacy';
ALTER TABLE karts_equalizacoes ADD COLUMN tempo_antes_ms INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN tempo_depois_ms INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN media_antes_ms INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN media_depois_ms INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN desvio_antes_ms INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN desvio_depois_ms INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN voltas_antes INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN voltas_depois INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN volta_antes INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN volta_depois INTEGER;
ALTER TABLE karts_equalizacoes ADD COLUMN capturado_em TEXT;
ALTER TABLE karts_equalizacoes ADD COLUMN responsavel TEXT;

CREATE INDEX IF NOT EXISTS idx_karts_equalizacoes_fonte
  ON karts_equalizacoes(fonte, data DESC);
