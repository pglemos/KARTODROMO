CREATE UNIQUE INDEX IF NOT EXISTS idx_classificacao_unique
ON classificacao(campeonato_id, piloto_id);
