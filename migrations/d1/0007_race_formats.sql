-- 0007_race_formats.sql
-- Formatos de corrida configuráveis (TT + corrida, paradas obrigatórias, pontuação por campeonato).
-- Princípios: nenhum parâmetro global hardcoded; punições sempre vêm da cronometragem em tempo real.

CREATE TABLE IF NOT EXISTS formatos_corrida (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tt_habilitada INTEGER NOT NULL DEFAULT 1 CHECK (tt_habilitada IN (0,1)),
  tt_duracao_min INTEGER,
  tt_define_grid INTEGER NOT NULL DEFAULT 1 CHECK (tt_define_grid IN (0,1)),
  tt_pontua INTEGER NOT NULL DEFAULT 0 CHECK (tt_pontua IN (0,1)),
  corrida_duracao_min INTEGER,
  paradas_habilitadas INTEGER NOT NULL DEFAULT 0 CHECK (paradas_habilitadas IN (0,1)),
  paradas_quantidade INTEGER NOT NULL DEFAULT 0,
  parada_tempo_minimo_ms INTEGER,
  boxes_abrem_apos_ms INTEGER,
  boxes_fecham_apos_ms INTEGER,
  paradas_adicionais_permitidas INTEGER NOT NULL DEFAULT 0,
  punicoes_fonte TEXT NOT NULL DEFAULT 'cronometragem' CHECK (punicoes_fonte IN ('cronometragem')),
  classificacao_fonte TEXT NOT NULL DEFAULT 'corrida' CHECK (classificacao_fonte IN ('corrida','melhor_tempo','combinada')),
  desempate TEXT,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Padrão do dia a dia do Kartódromo Internacional de Betim:
-- TT ~5 min define o grid (sem pontuar) -> corrida ~20 min sem parada obrigatória.
INSERT INTO formatos_corrida (
  id, nome, descricao, tt_habilitada, tt_duracao_min, tt_define_grid, tt_pontua,
  corrida_duracao_min, paradas_habilitadas, classificacao_fonte, desempate, is_default
)
SELECT 'fmt-padrao-betim', 'Padrão Betim — TT + Corrida',
       'Tomada de tempo (~5 min) monta o grid; corrida normal (~20 min) sem parada obrigatória. Punições aplicadas em tempo real pela cronometragem.',
       1, 5, 1, 0, 20, 0, 'corrida', '["melhor_volta","mais_voltas"]', 1
WHERE NOT EXISTS (SELECT 1 FROM formatos_corrida WHERE id = 'fmt-padrao-betim');

INSERT INTO formatos_corrida (
  id, nome, descricao, tt_habilitada, tt_duracao_min, tt_define_grid, tt_pontua,
  corrida_duracao_min, paradas_habilitadas, classificacao_fonte, desempate, is_default
)
SELECT 'fmt-tomada-de-tempo', 'Tomada de Tempo pura',
       'Somente tomada de tempo: classificação e pontuação pelo melhor tempo.',
       1, NULL, 1, 1, NULL, 0, 'melhor_tempo', '["segundo_melhor_volta","mais_voltas"]', 0
WHERE NOT EXISTS (SELECT 1 FROM formatos_corrida WHERE id = 'fmt-tomada-de-tempo');

INSERT INTO formatos_corrida (
  id, nome, descricao, tt_habilitada, tt_duracao_min, tt_define_grid, tt_pontua,
  corrida_duracao_min, paradas_habilitadas, paradas_quantidade, parada_tempo_minimo_ms,
  boxes_abrem_apos_ms, boxes_fecham_apos_ms, paradas_adicionais_permitidas, classificacao_fonte, is_default
)
SELECT 'fmt-endurance-paradas', 'Endurance com Paradas Obrigatórias',
       'Prova de longa duração com paradas mínimas em janela de boxes. Punições chegam prontas da cronometragem (LapTime).',
       1, NULL, 0, 0, NULL, 1, 11, 420000, 600000, 42000000, 4, 'corrida', 0
WHERE NOT EXISTS (SELECT 1 FROM formatos_corrida WHERE id = 'fmt-endurance-paradas');

ALTER TABLE campeonatos ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id);
ALTER TABLE campeonatos ADD COLUMN pontos_json TEXT;
ALTER TABLE campeonatos ADD COLUMN desempate_json TEXT;
ALTER TABLE campeonatos ADD COLUMN bonus_pole REAL DEFAULT 0;
ALTER TABLE campeonatos ADD COLUMN bonus_melhor_volta REAL DEFAULT 0;
ALTER TABLE campeonatos ADD COLUMN descartes INTEGER DEFAULT 0;

ALTER TABLE etapas ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id);
ALTER TABLE sessoes ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id);
ALTER TABLE corridas ADD COLUMN formato_id TEXT REFERENCES formatos_corrida(id);
