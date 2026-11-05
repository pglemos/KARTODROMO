CREATE TABLE mobile_orders (
  account_id TEXT NOT NULL REFERENCES mobile_accounts(id),
  idempotency_key TEXT NOT NULL,
  pedido_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  codigo TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('creating', 'ready')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, idempotency_key)
);

CREATE INDEX mobile_orders_account_created
  ON mobile_orders(account_id, created_at DESC);
