CREATE TABLE mobile_results (
  session_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  display_name TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  kart TEXT NOT NULL,
  laps INTEGER NOT NULL CHECK (laps >= 0),
  best_lap_ms INTEGER CHECK (best_lap_ms IS NULL OR best_lap_ms > 0),
  status TEXT NOT NULL CHECK (status IN ('published', 'withdrawn')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, customer_id)
);

CREATE INDEX mobile_results_public_listing
  ON mobile_results(status, event_date DESC, session_id, position);
CREATE INDEX mobile_results_customer_history
  ON mobile_results(customer_id, status, event_date DESC);

CREATE TABLE mobile_results_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  customer_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('publish', 'correct', 'withdraw')),
  previous_json TEXT,
  current_json TEXT,
  actor TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);

CREATE INDEX mobile_results_audit_session
  ON mobile_results_audit(session_id, changed_at DESC);

CREATE TABLE mobile_identity_links (
  customer_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES mobile_accounts(id) ON DELETE CASCADE,
  linked_at INTEGER NOT NULL
);

CREATE TABLE mobile_identity_link_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('linked')),
  changed_at INTEGER NOT NULL,
  UNIQUE (customer_id, account_id, action)
);
