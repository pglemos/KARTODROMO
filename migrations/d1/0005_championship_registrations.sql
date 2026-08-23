CREATE TABLE IF NOT EXISTS kartodromo_campeonato_inscricoes (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  campeonato_id TEXT,
  evento TEXT NOT NULL,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('equipe','individual')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','confirmada','recusada','cancelada')),
  nome_equipe TEXT,
  nome_chefe TEXT,
  nome_completo TEXT,
  cpf TEXT,
  data_nascimento TEXT,
  idade INTEGER,
  peso_kg REAL,
  email TEXT,
  telefone TEXT,
  cidade TEXT,
  experiencia TEXT,
  nivel_atual TEXT,
  disponibilidade TEXT,
  participacao_desejada TEXT,
  interesse_ranking TEXT,
  janelas_preferidas TEXT,
  equipamento TEXT,
  equipamento_detalhes TEXT,
  contato_emergencia_nome TEXT,
  contato_emergencia_telefone TEXT,
  restricoes_medicas TEXT,
  alergias TEXT,
  medicamentos TEXT,
  objetivos TEXT,
  observacoes TEXT,
  quantidade_karts INTEGER,
  pilotos TEXT NOT NULL DEFAULT '[]',
  pagamento TEXT,
  aceites TEXT NOT NULL DEFAULT '{}',
  admin_notes TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kartodromo_inscricoes_created
  ON kartodromo_campeonato_inscricoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kartodromo_inscricoes_status
  ON kartodromo_campeonato_inscricoes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kartodromo_inscricoes_evento
  ON kartodromo_campeonato_inscricoes(evento, created_at DESC);
