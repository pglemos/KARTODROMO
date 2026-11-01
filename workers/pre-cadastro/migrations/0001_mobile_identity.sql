PRAGMA foreign_keys = ON;

CREATE TABLE mobile_accounts (
  id TEXT PRIMARY KEY,
  name_cipher TEXT NOT NULL,
  email_lookup TEXT NOT NULL UNIQUE,
  email_cipher TEXT NOT NULL,
  cpf_lookup TEXT NOT NULL UNIQUE,
  cpf_cipher TEXT NOT NULL,
  phone_cipher TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations = 600000),
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE mobile_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES mobile_accounts(id),
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX mobile_sessions_account_id ON mobile_sessions(account_id);

CREATE TABLE mobile_email_tokens (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES mobile_accounts(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX mobile_email_tokens_account_purpose
  ON mobile_email_tokens(account_id, purpose, used_at);

CREATE TABLE mobile_auth_attempts (
  scope_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL
);
