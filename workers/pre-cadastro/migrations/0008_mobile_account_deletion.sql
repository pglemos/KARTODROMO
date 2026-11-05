-- Exclusão de conta em duas fases: marca, permite restaurar por 30 dias e só então apaga.
ALTER TABLE mobile_accounts ADD COLUMN deleted_at INTEGER;
CREATE INDEX mobile_accounts_deleted_at ON mobile_accounts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Registro permanente: não guarda dado pessoal legível (IP só como HMAC) e sobrevive à remoção da conta.
CREATE TABLE mobile_account_deletion_audit (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('requested', 'restored', 'purged')),
  session_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX mobile_account_deletion_audit_account ON mobile_account_deletion_audit(account_id, created_at);
