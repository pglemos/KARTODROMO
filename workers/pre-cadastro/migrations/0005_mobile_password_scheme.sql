-- O custo PBKDF2 existente fica preservado; parâmetros scrypt pertencem à versão do esquema.
ALTER TABLE mobile_accounts ADD COLUMN password_scheme TEXT NOT NULL
  DEFAULT 'pbkdf2-sha256-v1'
  CHECK (password_scheme IN ('pbkdf2-sha256-v1', 'scrypt-32768-8-3-v1'));
