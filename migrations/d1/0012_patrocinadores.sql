-- Patrocinadores e publicidade: empresas, espacos (outdoor, podio...), contratos, cobrancas e arquivos.

CREATE TABLE IF NOT EXISTS patro_empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  segmento TEXT,
  contato_nome TEXT,
  email TEXT,
  telefone TEXT,
  site TEXT,
  endereco TEXT,
  observacoes TEXT,
  logo_arquivo_id TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patro_espacos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outdoor' CHECK (tipo IN ('outdoor','podio','banner','telao','estrutura','outro')),
  localizacao TEXT,
  dimensoes TEXT,
  descricao TEXT,
  valor_tabela REAL NOT NULL DEFAULT 0 CHECK (valor_tabela >= 0),
  foto_arquivo_id TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patro_contratos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES patro_empresas(id) ON DELETE CASCADE,
  espaco_id TEXT REFERENCES patro_espacos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativo','encerrado','cancelado')),
  valor REAL NOT NULL DEFAULT 0 CHECK (valor >= 0),
  recorrencia TEXT NOT NULL DEFAULT 'mensal' CHECK (recorrencia IN ('unico','mensal','bimestral','trimestral','semestral','anual')),
  dia_vencimento INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  renovacao_automatica INTEGER NOT NULL DEFAULT 0 CHECK (renovacao_automatica IN (0,1)),
  arte_arquivo_id TEXT,
  contrato_arquivo_id TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patro_cobrancas (
  id TEXT PRIMARY KEY,
  contrato_id TEXT NOT NULL REFERENCES patro_contratos(id) ON DELETE CASCADE,
  parcela INTEGER NOT NULL DEFAULT 1,
  vencimento TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor >= 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  pago_em TEXT,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contrato_id, parcela)
);

CREATE TABLE IF NOT EXISTS patro_arquivos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  mime TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outro' CHECK (categoria IN ('logo','arte','contrato','foto','outro')),
  empresa_id TEXT,
  contrato_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patro_arquivo_partes (
  arquivo_id TEXT NOT NULL REFERENCES patro_arquivos(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  dados TEXT NOT NULL,
  PRIMARY KEY (arquivo_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_patro_contratos_empresa ON patro_contratos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_patro_contratos_fim ON patro_contratos(data_fim);
CREATE INDEX IF NOT EXISTS idx_patro_cobrancas_venc ON patro_cobrancas(vencimento, status);
CREATE INDEX IF NOT EXISTS idx_patro_arquivos_contrato ON patro_arquivos(contrato_id);

CREATE VIEW IF NOT EXISTS patro_contratos_full AS
SELECT c.*, e.nome AS empresa_nome, s.nome AS espaco_nome, s.tipo AS espaco_tipo
FROM patro_contratos c
LEFT JOIN patro_empresas e ON e.id = c.empresa_id
LEFT JOIN patro_espacos s ON s.id = c.espaco_id;

CREATE VIEW IF NOT EXISTS patro_cobrancas_full AS
SELECT b.id, b.contrato_id, b.parcela, b.vencimento, b.valor, b.pago_em, b.forma_pagamento, b.observacoes, b.created_at,
       CASE WHEN b.status = 'pendente' AND b.vencimento < date('now') THEN 'atrasado' ELSE b.status END AS status,
       c.titulo AS contrato_titulo, c.empresa_id, e.nome AS empresa_nome
FROM patro_cobrancas b
LEFT JOIN patro_contratos c ON c.id = b.contrato_id
LEFT JOIN patro_empresas e ON e.id = c.empresa_id;
