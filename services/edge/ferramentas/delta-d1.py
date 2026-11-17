#!/usr/bin/env python3
"""Delta da virada de um D1: linhas que a Cloudflare gravou entre o export usado na importação e a troca de DNS.
Uso (na VPS): python3 delta-d1.py <export-importado.sql.gz> <export-depois-da-virada.sql.gz> <banco-vivo.sqlite> [--aplicar]
Mostra, por tabela, linhas novas/alteradas no D1 depois do export importado. Com --aplicar, grava as NOVAS (chave que não existe
no banco vivo) com INSERT OR IGNORE; alteradas só são listadas (o banco vivo pode ter mudado depois da virada).
"""
import gzip
import sqlite3
import sys

antes, depois, vivo = sys.argv[1:4]
aplicar = "--aplicar" in sys.argv


def carregar(caminho):
    db = sqlite3.connect(":memory:")
    with gzip.open(caminho, "rt", encoding="utf-8") as f:
        db.executescript(f.read())
    return db


a, d = carregar(antes), carregar(depois)
v = sqlite3.connect(vivo, timeout=10)
total_novas = 0
for (t,) in d.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
    cols = [r[1] for r in d.execute(f'PRAGMA table_info("{t}")')]
    pk = [r[1] for r in sorted(d.execute(f'PRAGMA table_info("{t}")'), key=lambda r: r[5]) if r[5] > 0] or ["rowid"]
    sel = ", ".join(f'"{c}"' for c in cols)
    linhas_a = set(a.execute(f'SELECT {sel} FROM "{t}"').fetchall()) if a.execute("SELECT 1 FROM sqlite_master WHERE name=?", (t,)).fetchone() else set()
    linhas_d = d.execute(f'SELECT {sel} FROM "{t}"').fetchall()
    diferentes = [r for r in linhas_d if r not in linhas_a]
    if not diferentes:
        continue
    idx = [cols.index(c) for c in pk if c in cols]
    novas, alteradas = [], []
    for r in diferentes:
        chave = tuple(r[i] for i in idx)
        cond = " AND ".join(f'"{pk[j]}" IS ?' for j in range(len(idx)))
        existe = v.execute(f'SELECT 1 FROM "{t}" WHERE {cond}', chave).fetchone() if idx else None
        (alteradas if existe else novas).append(r)
    print(f"{t}: {len(novas)} novas, {len(alteradas)} alteradas")
    for r in alteradas[:5]:
        print("   alterada:", str(r)[:200])
    if aplicar and novas:
        v.executemany(f'INSERT OR IGNORE INTO "{t}" ({sel}) VALUES ({", ".join("?" * len(cols))})', novas)
        v.commit()
        print(f"   {len(novas)} gravadas")
    total_novas += len(novas)
print("total de linhas novas:", total_novas, "(aplicadas)" if aplicar else "(só listadas)")
