-- E-mails de conta (confirmação e troca de senha) esperando o servidor da cronometragem enviar pela HostGator
-- (a mesma saída dos resultados). Cada linha some depois de enviada; nada fica mais de 1 h.
CREATE TABLE mobile_email_outbox (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER
);
CREATE INDEX mobile_email_outbox_created ON mobile_email_outbox(created_at);
