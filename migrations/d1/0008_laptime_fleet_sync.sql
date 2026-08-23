-- Sincronização da frota real do LapTime.
-- Os valores de uso e o sensor de origem são somente leitura no cadastro local;
-- chassi, redutor e observações continuam sendo dados operacionais cadastrados.
ALTER TABLE karts ADD COLUMN laptime_quantity INTEGER;
ALTER TABLE karts ADD COLUMN laptime_time_of_use_ms INTEGER;
ALTER TABLE karts ADD COLUMN laptime_status_control INTEGER;
ALTER TABLE karts ADD COLUMN laptime_updated_at TEXT;
ALTER TABLE karts ADD COLUMN sensor_numero_fonte TEXT;
ALTER TABLE karts ADD COLUMN sensor_fonte_atualizado_em TEXT;
ALTER TABLE karts ADD COLUMN data_source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_karts_data_source ON karts(data_source, ativo);
