PRAGMA foreign_keys = ON;

-- ============================================================
-- MIGRATION 0004: Schema Fixes + Clube de Vantagens
-- ============================================================

-- 1. FIX: profiles role constraint - extend to include all RBAC roles
-- Handled cleanly in schema initialization

-- 2. FIX: clientes - add missing columns (cidade, estado, created_at, cpf)
-- Handled cleanly in schema initialization

-- Note: 'cpf' is the internal column name; 'documento' is used by the UI type.
-- The admin-d1.ts resource config maps 'cpf' column so UI should use 'cpf'.
-- We'll keep 'cpf' in DB and fix the UI type to use 'cpf' (done in code fix).

-- 3. CLUBE DE VANTAGENS TABLES

CREATE TABLE IF NOT EXISTS clube_participantes (
  id TEXT PRIMARY KEY,
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT,
  pontos INTEGER NOT NULL DEFAULT 0 CHECK (pontos >= 0),
  nivel TEXT NOT NULL DEFAULT 'bronze' CHECK (nivel IN ('bronze','prata','ouro','platina')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clube_recompensas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL,
  pontos_necessarios INTEGER NOT NULL CHECK (pontos_necessarios > 0),
  estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  imagem_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clube_resgates (
  id TEXT PRIMARY KEY,
  participante_id TEXT NOT NULL REFERENCES clube_participantes(id) ON DELETE CASCADE,
  recompensa_id TEXT NOT NULL REFERENCES clube_recompensas(id) ON DELETE CASCADE,
  pontos INTEGER NOT NULL CHECK (pontos > 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','entregue')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clube_campanhas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'bonus' CHECK (tipo IN ('bonus','multiplicador','especial')),
  multiplicador REAL NOT NULL DEFAULT 1.0 CHECK (multiplicador > 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  data_inicio TEXT,
  data_fim TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clube_transacoes (
  id TEXT PRIMARY KEY,
  participante_id TEXT NOT NULL REFERENCES clube_participantes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ganho','resgate','expiracao','ajuste')),
  pontos INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  referencia TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. KARTS MANAGEMENT TABLE (for maintenance tracking)
CREATE TABLE IF NOT EXISTS karts (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL DEFAULT 'Kart Aluguel',
  categoria TEXT NOT NULL DEFAULT 'adulto' CHECK (categoria IN ('adulto','junior','super')),
  motor TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','em_uso','manutencao','inativo')),
  km_total REAL NOT NULL DEFAULT 0 CHECK (km_total >= 0),
  ultima_manutencao TEXT,
  proxima_manutencao TEXT,
  notes TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS karts_manutencao (
  id TEXT PRIMARY KEY,
  kart_id TEXT NOT NULL REFERENCES karts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  custo REAL DEFAULT 0 CHECK (custo >= 0),
  data TEXT NOT NULL DEFAULT (date('now')),
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. EVENTOS TABLE (for events/parties management)
CREATE TABLE IF NOT EXISTS eventos (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'bateria' CHECK (tipo IN ('bateria','aniversario','corporativo','campeonato','treino','especial')),
  cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
  pista_id TEXT REFERENCES pistas(id) ON DELETE SET NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  qtd_participantes INTEGER NOT NULL DEFAULT 1 CHECK (qtd_participantes > 0),
  valor REAL NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','confirmado','em_andamento','concluido','cancelado')),
  cor_tema TEXT DEFAULT '#22c55e',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. INDEXES for new tables
CREATE INDEX IF NOT EXISTS idx_clube_participantes_cliente ON clube_participantes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clube_resgates_participante ON clube_resgates(participante_id, status);
CREATE INDEX IF NOT EXISTS idx_clube_transacoes_participante ON clube_transacoes(participante_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_karts_status ON karts(status, ativo);
CREATE INDEX IF NOT EXISTS idx_karts_manutencao_kart ON karts_manutencao(kart_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(status);

-- 7. VIEWS for new tables
CREATE VIEW IF NOT EXISTS clube_resgates_full AS
SELECT r.*, p.nome AS participante_nome, p.pontos AS participante_pontos,
       rw.nome AS recompensa_nome, rw.pontos_necessarios
FROM clube_resgates r
LEFT JOIN clube_participantes p ON p.id = r.participante_id
LEFT JOIN clube_recompensas rw ON rw.id = r.recompensa_id;

CREATE VIEW IF NOT EXISTS eventos_full AS
SELECT e.*, c.nome AS cliente_nome, p.nome AS pista_nome
FROM eventos e
LEFT JOIN clientes c ON c.id = e.cliente_id
LEFT JOIN pistas p ON p.id = e.pista_id;

CREATE VIEW IF NOT EXISTS karts_full AS
SELECT k.*, 
  (SELECT COUNT(*) FROM karts_manutencao m WHERE m.kart_id = k.id AND m.status != 'concluida') AS manutencoes_pendentes
FROM karts k;

-- 8. SEED: Clube de Vantagens initial data
INSERT OR IGNORE INTO clube_recompensas (id, nome, descricao, categoria, pontos_necessarios, estoque, ativo) VALUES
('rw-001', 'Boné Oficial Kartódromo', 'Boné bordado com logo oficial', 'Vestuário', 100, 18, 1),
('rw-002', 'Troféu Pequeno', 'Troféu personalizado do kartódromo', 'Colecionável', 100, 12, 1),
('rw-003', 'Camiseta Oficial', 'Camiseta dry-fit com logo', 'Vestuário', 200, 9, 1),
('rw-004', 'Voucher para uma corrida', 'Bateria de 10 min gratuita', 'Experiência', 300, 30, 1),
('rw-005', 'Voucher Lanchonete R$30', 'Vale R$30 na lanchonete', 'Alimentação', 150, 50, 1),
('rw-006', 'Kit Piloto Completo', 'Luva + balaclava + suporte pescoço', 'Equipamentos', 500, 5, 1);

INSERT OR IGNORE INTO clube_campanhas (id, nome, descricao, tipo, multiplicador, ativo) VALUES
('camp-van-001', 'Bônus de Aniversário', 'Ganhe pontos em dobro no mês do seu aniversário', 'multiplicador', 2.0, 1),
('camp-van-002', 'Indique um Amigo', 'Ganhe 50 pontos por amigo indicado que correr', 'bonus', 1.0, 1),
('camp-van-003', 'Dose Dupla Fim de Ano', 'Pontos em dobro em dezembro', 'multiplicador', 2.0, 0);

-- 9. SEED: Karts
INSERT OR IGNORE INTO karts (id, numero, modelo, categoria, motor, status, km_total) VALUES
('kart-01', '01', 'Birel Art N35', 'adulto', 'Honda GX270', 'disponivel', 12450.5),
('kart-02', '02', 'Birel Art N35', 'adulto', 'Honda GX270', 'disponivel', 10200.0),
('kart-03', '03', 'Birel Art N35', 'adulto', 'Honda GX270', 'manutencao', 18900.3),
('kart-04', '04', 'Birel Art N35', 'adulto', 'Honda GX270', 'disponivel', 8700.8),
('kart-05', '05', 'Birel Art N35', 'adulto', 'Honda GX270', 'disponivel', 11300.2),
('kart-06', '06', 'Birel Art N35', 'adulto', 'Honda GX270', 'disponivel', 9800.0),
('kart-07', '07', 'Birel Art N35', 'adulto', 'Honda GX270', 'disponivel', 13200.7),
('kart-08', '08', 'Birel Art N35', 'adulto', 'Honda GX270', 'em_uso', 7500.4),
('kart-09', '09', 'CRG Road Rebel', 'junior', 'Yamaha KT100', 'disponivel', 5200.1),
('kart-10', '10', 'CRG Road Rebel', 'junior', 'Yamaha KT100', 'disponivel', 4100.6),
('kart-11', '11', 'CRG Road Rebel', 'junior', 'Yamaha KT100', 'disponivel', 6300.9),
('kart-12', '12', 'CRG Road Rebel', 'junior', 'Yamaha KT100', 'manutencao', 9100.2),
('kart-S1', 'S1', 'Tony Kart Racer 401R', 'super', 'TM KZ10C 125cc', 'disponivel', 3200.0),
('kart-S2', 'S2', 'Tony Kart Racer 401R', 'super', 'TM KZ10C 125cc', 'disponivel', 2800.5);

-- 10. SEED: Clube Participantes & Resgates
INSERT OR IGNORE INTO clube_participantes (id, cliente_id, nome, email, pontos, nivel, ativo) VALUES
('part-001', 'cli-001', 'Fernando Silva Costa', 'fernando.costa@email.com', 450, 'ouro', 1),
('part-002', 'cli-002', 'Arthur Neves Gomes', 'arthur.gomes@email.com', 280, 'prata', 1),
('part-003', 'cli-003', 'Rodrigo Oliveira Santos', 'rodrigo.santos@email.com', 620, 'platina', 1),
('part-004', 'cli-004', 'Camila Rodrigues Lima', 'camila.lima@email.com', 150, 'bronze', 1),
('part-005', 'cli-005', 'Lucas Gabriel Pereira', 'lucas.pereira@email.com', 310, 'prata', 1);

INSERT OR IGNORE INTO clube_resgates (id, participante_id, recompensa_id, pontos, status, notes) VALUES
('resg-001', 'part-001', 'rw-001', 100, 'pendente', 'Solicitado resgate do Boné Oficial'),
('resg-002', 'part-002', 'rw-002', 100, 'pendente', 'Solicitado Troféu Pequeno'),
('resg-003', 'part-003', 'rw-004', 300, 'aprovado', 'Voucher para corrida aprovado pelo operador');
