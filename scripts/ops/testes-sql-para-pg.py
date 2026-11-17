#!/usr/bin/env python3
"""Atualiza os mocks de banco dos testes para o SQL do Postgres (schema kart).

Os testes reconhecem a consulta por pedaços do texto (`sql.includes('FROM dbo.Bateria')`). Este script troca cada
`<var>.includes('<trecho>')` cujo trecho seja SQL por `tem(<var>, '<trecho no Postgres>')`, comparando sem diferenciar
maiúsculas (o código portado mistura `SELECT`/`select`), e põe o helper `tem` no topo do arquivo.
Uso: python3 scripts/ops/testes-sql-para-pg.py tests/ops/arquivo.test.ts [--aplicar]
"""
import importlib.util
import re
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("tsql", Path(__file__).with_name("tsql-para-pg.py"))
tsql = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tsql)

SQLISH = re.compile(r"dbo\.|\b(SELECT|UPDATE|INSERT|DELETE|FROM|WHERE|SET|OUTPUT|CONVERT|SYSDATETIME|COUNT|ISNULL|TOP)\b|\b[A-Z][a-z]+[A-Z]\w*\b|\b[a-z]\.[A-Z]")


def traduz(trecho: str) -> str:
    rev: list = []
    s = trecho
    s = re.sub(r"CONVERT\(varchar\((\d+)\),\s*([\w.]+)", lambda m: f"to_char({m.group(2)}", s, flags=re.I)
    s = re.sub(r"SELECT CONVERT\(varchar\((\d+)\)", "SELECT to_char(", s, flags=re.I)
    s = re.sub(r"\bSYSDATETIME\(\)", "now()", s, flags=re.I)
    s = re.sub(r"\bISNULL\(", "coalesce(", s, flags=re.I)
    s = re.sub(r"OUTPUT inserted\.(\w+)", lambda m: "returning " + tsql.COLUNAS.get(m.group(1), tsql.snake(m.group(1))), s, flags=re.I)
    s = re.sub(r"\bdbo\.\[?(\w+)\]?", lambda m: tsql.TABELAS.get(m.group(1), "kart." + tsql.snake(m.group(1))), s)
    s = re.sub(r"\bINSERT\s+(kart\.)", r"INSERT INTO \1", s, flags=re.I)
    s = re.sub(r"\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*)\b", lambda m: tsql.COLUNAS.get(m.group(1), tsql.snake(m.group(1))) if m.group(1).upper() not in tsql.PALAVRAS else m.group(1), s)
    s = re.sub(r"\b(\w+) = 1\b", lambda m: f"{m.group(1)} = true" if m.group(1) in tsql.BITS else m.group(0), s)
    s = re.sub(r"\b(\w+) = 0\b", lambda m: f"{m.group(1)} = false" if m.group(1) in tsql.BITS else m.group(0), s)
    return s


def processar(caminho: Path, aplicar: bool):
    src = caminho.read_text(encoding="utf-8")
    trocas = []

    def rep(m):
        var, aspas, trecho = m.group(1), m.group(2), m.group(3)
        if not SQLISH.search(trecho):
            return m.group(0)
        novo = traduz(trecho).replace(aspas, "\\" + aspas)
        trocas.append((trecho, novo))
        return f"tem({var}, {aspas}{novo}{aspas})"

    out = re.sub(r"\b(\w+(?:\.\w+)*)\.includes\((['\"`])((?:\\.|(?!\2).)*)\2\)", rep, src)
    if trocas and "const tem = (" not in out:
        helper = "/** O SQL do Postgres mistura maiúsculas e minúsculas: compara sem diferenciar. */\nconst tem = (sql: unknown, trecho: string) => String(sql).toLowerCase().includes(trecho.toLowerCase());\n"
        ultimo_import = 0
        for m in re.finditer(r"^import [^;]+;\n", out, re.M):
            ultimo_import = m.end()
        out = out[:ultimo_import] + "\n" + helper + out[ultimo_import:]
    for a, b in trocas:
        print(f"  {a!r:70.70} -> {b!r}")
    print(f"{caminho}: {len(trocas)} trocas")
    if aplicar:
        caminho.write_text(out, encoding="utf-8")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        if p != "--aplicar":
            processar(Path(p), "--aplicar" in sys.argv)
