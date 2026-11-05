-- Comprovantes de pagamento anexados pelo atendente a um pagamento registrado na reserva em grupo.
-- O arquivo fica no R2 (binding COMPROVANTES); aqui só ficam os dados para achar e mostrar o arquivo.
-- grupo_id e pagamento_id são os ids do KartodromoOps (SRVKART): não há chave estrangeira entre bancos.
CREATE TABLE IF NOT EXISTS comprovantes_pagamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL,
  pagamento_id INTEGER NOT NULL,
  chave TEXT NOT NULL UNIQUE,
  nome_arquivo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  enviado_por TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comprovantes_grupo ON comprovantes_pagamento (grupo_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_pagamento ON comprovantes_pagamento (grupo_id, pagamento_id);
