-- Anexos e comprovantes de pagamento feitos por fora do Asaas (Pix na conta, maquininha, dinheiro, contrato assinado...)
-- ligados a reserva, grupo, bateria/evento, campeonato e patrocínio. Arquivo no R2 COMPROVANTES; aqui só o que acha ele.
-- O admin (comprovantes.ts) também cria a tabela sozinho na primeira chamada (CREATE TABLE IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade TEXT NOT NULL CHECK (entidade IN ('reserva','reserva_online','grupo','bateria','campeonato','patrocinio_contrato','patrocinio_cobranca','cliente')),
  entidade_id TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'comprovante' CHECK (categoria IN ('comprovante','contrato','arte','logo','foto','documento','outro')),
  descricao TEXT,
  valor REAL,
  pago_em TEXT,
  forma TEXT,
  chave TEXT NOT NULL UNIQUE,
  nome_arquivo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  enviado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON anexos (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_anexos_criado ON anexos (criado_em);
