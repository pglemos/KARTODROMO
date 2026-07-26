PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','staff','viewer','financeiro','recepcao','lanchonete','operador_telao')),
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  documento TEXT,
  cidade TEXT,
  estado TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  criadoEm TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS pistas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0,1))
);

CREATE TABLE IF NOT EXISTS reservas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  pista_id TEXT REFERENCES pistas(id) ON DELETE SET NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  qtd_pilotos INTEGER NOT NULL DEFAULT 1 CHECK (qtd_pilotos > 0),
  valor REAL NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada','cancelada','concluida')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recepcao_atendimentos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT,
  reserva_id TEXT REFERENCES reservas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','em_atendimento','finalizado','cancelado')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lanchonete_produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  preco REAL NOT NULL CHECK (preco >= 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1))
);

CREATE TABLE IF NOT EXISTS lanchonete_estoque (
  id TEXT PRIMARY KEY,
  produto_id TEXT NOT NULL UNIQUE REFERENCES lanchonete_produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  min_alerta INTEGER NOT NULL DEFAULT 0 CHECK (min_alerta >= 0)
);

CREATE TABLE IF NOT EXISTS lanchonete_vendas (
  id TEXT PRIMARY KEY,
  total REAL NOT NULL CHECK (total >= 0),
  pagamento TEXT NOT NULL CHECK (pagamento IN ('dinheiro','cartao','pix','cortesia')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lanchonete_venda_itens (
  id TEXT PRIMARY KEY,
  venda_id TEXT NOT NULL REFERENCES lanchonete_vendas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES lanchonete_produtos(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unit REAL NOT NULL CHECK (preco_unit >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS financeiro_categorias (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa'))
);

CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor >= 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria_id TEXT NOT NULL REFERENCES financeiro_categorias(id),
  data TEXT NOT NULL,
  origem TEXT,
  origem_ref TEXT,
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','confirmado','cancelado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campeonatos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT,
  temporada TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('ativo','encerrado','rascunho'))
);

CREATE TABLE IF NOT EXISTS etapas (
  id TEXT PRIMARY KEY,
  campeonato_id TEXT REFERENCES campeonatos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data TEXT,
  round INTEGER,
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada'))
);

CREATE TABLE IF NOT EXISTS pilotos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  numero TEXT,
  equipe TEXT,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS classificacao (
  id TEXT PRIMARY KEY,
  campeonato_id TEXT REFERENCES campeonatos(id) ON DELETE CASCADE,
  piloto_id TEXT REFERENCES pilotos(id) ON DELETE CASCADE,
  pontos REAL NOT NULL DEFAULT 0,
  posicao INTEGER
);

CREATE TABLE IF NOT EXISTS sessoes (
  id TEXT PRIMARY KEY,
  campeonato_id TEXT REFERENCES campeonatos(id) ON DELETE SET NULL,
  etapa_id TEXT REFERENCES etapas(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('treino','classificacao','corrida')),
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','encerrada')),
  fonte TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voltas (
  id TEXT PRIMARY KEY,
  sessao_id TEXT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  piloto_id TEXT REFERENCES pilotos(id) ON DELETE SET NULL,
  piloto_nome TEXT NOT NULL,
  kart TEXT,
  numero INTEGER NOT NULL,
  tempo_ms INTEGER NOT NULL CHECK (tempo_ms >= 0),
  setor1_ms INTEGER,
  setor2_ms INTEGER,
  setor3_ms INTEGER,
  posicao INTEGER,
  melhor INTEGER NOT NULL DEFAULT 0 CHECK (melhor IN (0,1)),
  valida INTEGER NOT NULL DEFAULT 1 CHECK (valida IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS corridas (
  id TEXT PRIMARY KEY,
  etapa_id TEXT REFERENCES etapas(id) ON DELETE SET NULL,
  campeonato_id TEXT REFERENCES campeonatos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  data TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada')),
  source TEXT
);

CREATE TABLE IF NOT EXISTS resultados (
  id TEXT PRIMARY KEY,
  corrida_id TEXT REFERENCES corridas(id) ON DELETE CASCADE,
  piloto_id TEXT REFERENCES pilotos(id) ON DELETE SET NULL,
  piloto_nome TEXT NOT NULL,
  posicao INTEGER,
  melhor_volta TEXT,
  voltas INTEGER,
  pontos REAL,
  gap TEXT
);

CREATE TABLE IF NOT EXISTS cronometragem_live (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservas_data ON reservas(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);
CREATE INDEX IF NOT EXISTS idx_recepcao_status ON recepcao_atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_etapas_campeonato ON etapas(campeonato_id);
CREATE INDEX IF NOT EXISTS idx_classificacao_campeonato ON classificacao(campeonato_id, posicao);
CREATE INDEX IF NOT EXISTS idx_sessoes_campeonato ON sessoes(campeonato_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_voltas_sessao ON voltas(sessao_id, posicao);
CREATE INDEX IF NOT EXISTS idx_corridas_campeonato ON corridas(campeonato_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_resultados_corrida ON resultados(corrida_id, posicao);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE VIEW IF NOT EXISTS reservas_full AS
SELECT r.*, c.nome AS cliente_nome, p.nome AS pista_nome
FROM reservas r LEFT JOIN clientes c ON c.id = r.cliente_id LEFT JOIN pistas p ON p.id = r.pista_id;

CREATE VIEW IF NOT EXISTS recepcao_full AS
SELECT a.*, c.nome AS cliente_nome, r.data_inicio AS reserva_data_inicio, r.status AS reserva_status
FROM recepcao_atendimentos a LEFT JOIN clientes c ON c.id = a.cliente_id LEFT JOIN reservas r ON r.id = a.reserva_id;

CREATE VIEW IF NOT EXISTS etapas_full AS
SELECT e.*, c.nome AS campeonato_nome FROM etapas e LEFT JOIN campeonatos c ON c.id = e.campeonato_id;

CREATE VIEW IF NOT EXISTS classificacao_full AS
SELECT cl.*, p.nome AS piloto_nome, p.numero AS piloto_numero, p.equipe AS piloto_equipe
FROM classificacao cl LEFT JOIN pilotos p ON p.id = cl.piloto_id;

CREATE VIEW IF NOT EXISTS sessoes_full AS
SELECT s.*, c.nome AS campeonato_nome FROM sessoes s LEFT JOIN campeonatos c ON c.id = s.campeonato_id;

CREATE VIEW IF NOT EXISTS corridas_full AS
SELECT c.*, ca.nome AS campeonato_nome, e.nome AS etapa_nome
FROM corridas c LEFT JOIN campeonatos ca ON ca.id = c.campeonato_id LEFT JOIN etapas e ON e.id = c.etapa_id;

CREATE VIEW IF NOT EXISTS resultados_full AS
SELECT r.*, p.numero AS piloto_numero, p.equipe AS piloto_equipe
FROM resultados r LEFT JOIN pilotos p ON p.id = r.piloto_id;

CREATE VIEW IF NOT EXISTS financeiro_full AS
SELECT l.*, c.nome AS categoria_nome, c.tipo AS categoria_tipo
FROM financeiro_lancamentos l LEFT JOIN financeiro_categorias c ON c.id = l.categoria_id;

INSERT OR IGNORE INTO pistas (id, nome, descricao, ativa)
VALUES ('pista-principal', 'Pista Principal', 'Kartódromo Internacional de Betim', 1);
