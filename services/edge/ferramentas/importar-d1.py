#!/usr/bin/env python3
"""Importa o dump SQL do D1 (`wrangler d1 export --remote`) num arquivo SQLite novo para o kart-edge.
Uso (na VPS): python3 importar-d1.py <dump.sql[.gz]> <destino.sqlite>
Gera <destino>.novo, confere integridade e imprime a contagem por tabela; quem chama faz a troca do arquivo.
"""
import gzip
import os
import sqlite3
import sys

origem, destino = sys.argv[1], sys.argv[2]
novo = destino + ".novo"
for f in (novo, novo + "-wal", novo + "-shm"):
    if os.path.exists(f):
        os.remove(f)
abrir = gzip.open if origem.endswith(".gz") else open
with abrir(origem, "rt", encoding="utf-8") as f:
    sql = f.read()
db = sqlite3.connect(novo)
db.execute("PRAGMA journal_mode = WAL")
db.executescript("BEGIN;" + sql + ";COMMIT;")
assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "integridade falhou"
tabelas = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
for t in tabelas:
    print(f"{t}|{db.execute(f'SELECT count(*) FROM \"{t}\"').fetchone()[0]}")
db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
db.close()
print("ok", novo)
