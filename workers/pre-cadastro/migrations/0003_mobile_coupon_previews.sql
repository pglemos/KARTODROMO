CREATE TABLE mobile_coupon_previews (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES mobile_accounts(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  bateria_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 10),
  state TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
  result_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX mobile_coupon_previews_pending
  ON mobile_coupon_previews(state, expires_at, created_at);
