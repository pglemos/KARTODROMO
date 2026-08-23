-- Equalizacao de frota: identidade fisica, sensores e medicoes de pista.
ALTER TABLE karts ADD COLUMN chassi_numero TEXT;
ALTER TABLE karts ADD COLUMN sensor_numero TEXT;
ALTER TABLE karts ADD COLUMN redutor_antigo TEXT;
ALTER TABLE karts ADD COLUMN redutor_novo TEXT;
ALTER TABLE karts ADD COLUMN ultimo_piloto_equalizacao TEXT;
ALTER TABLE karts ADD COLUMN traco_equalizacao TEXT;
ALTER TABLE karts ADD COLUMN media_equalizacao_ms INTEGER;
ALTER TABLE karts ADD COLUMN melhor_equalizacao_ms INTEGER;
ALTER TABLE karts ADD COLUMN desvio_equalizacao_ms INTEGER;
ALTER TABLE karts ADD COLUMN ultima_equalizacao TEXT;

CREATE TABLE IF NOT EXISTS karts_equalizacoes (
  id TEXT PRIMARY KEY,
  kart_id TEXT NOT NULL REFERENCES karts(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('indoor','super','unknown')),
  piloto TEXT NOT NULL,
  traco TEXT NOT NULL,
  data TEXT NOT NULL,
  voltas_validas INTEGER NOT NULL DEFAULT 0 CHECK (voltas_validas >= 0),
  melhor_volta_ms INTEGER NOT NULL CHECK (melhor_volta_ms > 0),
  media_ms INTEGER NOT NULL CHECK (media_ms > 0),
  desvio_ms INTEGER NOT NULL DEFAULT 0 CHECK (desvio_ms >= 0),
  alvo_ms INTEGER NOT NULL CHECK (alvo_ms > 0),
  status TEXT NOT NULL DEFAULT 'reteste' CHECK (status IN ('aprovada','ajustar','reteste','cancelada')),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS karts_identidade_historico (
  id TEXT PRIMARY KEY,
  kart_id TEXT NOT NULL REFERENCES karts(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT (datetime('now')),
  acao TEXT NOT NULL CHECK (acao IN ('cadastro','troca_identidade','correcao')),
  chassi_anterior TEXT,
  chassi_novo TEXT,
  placa_anterior TEXT,
  placa_nova TEXT,
  sensor_anterior TEXT,
  sensor_novo TEXT,
  observacoes TEXT,
  responsavel TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_karts_equalizacoes_kart_data
  ON karts_equalizacoes(kart_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_karts_equalizacoes_categoria_data
  ON karts_equalizacoes(categoria, data DESC);
CREATE INDEX IF NOT EXISTS idx_karts_identidade_kart_data
  ON karts_identidade_historico(kart_id, data DESC);

DROP VIEW IF EXISTS karts_full;
CREATE VIEW karts_full AS
SELECT k.*,
  (SELECT COUNT(*) FROM karts_manutencao m WHERE m.kart_id = k.id AND m.status != 'concluida') AS manutencoes_pendentes
FROM karts k;

CREATE VIEW IF NOT EXISTS karts_equalizacoes_full AS
SELECT e.*, k.numero AS kart_numero, k.chassi_numero, k.sensor_numero,
       k.modelo, k.status AS kart_status
FROM karts_equalizacoes e
JOIN karts k ON k.id = e.kart_id;
