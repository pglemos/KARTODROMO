-- Ranking e carreira públicos do app: o SRVKART publica de tempos em tempos (só nome, tempos e contagens de corridas).
CREATE TABLE mobile_ranking (
  chave TEXT PRIMARY KEY,          -- 'ranking' (todos os períodos e traçados) ou 'piloto:<cliente>'
  dados TEXT NOT NULL,             -- JSON já filtrado no SRVKART
  atualizado_em INTEGER NOT NULL
);
