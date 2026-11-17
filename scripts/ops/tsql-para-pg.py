#!/usr/bin/env python3
"""Tradutor mecânico T-SQL -> Postgres (schema kart) para os trechos SQL de um arquivo TypeScript.

Uso: python3 scripts/ops/tsql-para-pg.py lib/ops/arquivo.ts [--aplicar]
Sem --aplicar só mostra o que mudaria e o que precisa de revisão à mão.

Converte só dentro de template literals/strings que parecem SQL, sem tocar nos trechos ${...}:
- dbo.Tabela -> kart.tabela; ColunaPascal -> coluna_snake (pelo mapa-nomes.json do Kartódromo OS)
- apelido camelCase -> "camelCase" (o Postgres dobraria para minúsculas)
- SYSDATETIME/GETDATE -> now(); ISNULL -> coalesce; LEN -> length; LTRIM(RTRIM(x)) -> trim(x)
- CONVERT(varchar(19|16|10|5), x, 126|108) -> to_char(...); CONVERT(date, x)/CAST(x AS date) -> (x)::date
- DATEADD(unidade, n, x) -> (x + make_interval(...)); coluna bit = 1/0 -> = true/false
- 'texto' + x -> 'texto' || x; N'..' -> '..'
- TOP n (nível de topo) -> limit n no fim; OUTPUT inserted.X -> returning X; WITH (UPDLOCK...) -> for update
O que não dá para converter com segurança fica listado como REVISAR.
"""
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
OS = Path.home() / "PROJETOS" / "kartodromo-os" / "supabase"
MAPA = json.loads((OS / "kartodromo" / "mapa-nomes.json").read_text(encoding="utf-8"))
FONTE = (OS / "kartodromo-schema-fonte.txt").read_text(encoding="utf-8", errors="replace")

TABELAS = {t: v["tabela"] for t, v in MAPA.items()}
TABELAS["EndurancePilotoInscricao"] = "kart.endurance_piloto_inscricao"
COLUNAS: dict[str, str] = {}
for v in MAPA.values():
    COLUNAS.update(v["colunas"])
BITS = set()
sec = None
for linha in FONTE.splitlines():
    if linha.startswith("##"):
        sec = linha[2:]
        continue
    if sec == "COLS":
        p = linha.split("|")
        if len(p) > 2 and p[2].lower() == "bit":
            BITS.add(COLUNAS.get(p[1], p[1].lower()))

PALAVRAS = set("""SELECT FROM WHERE AND OR NOT NULL IS IN AS ON JOIN LEFT RIGHT INNER OUTER FULL CROSS UNION ALL DISTINCT ORDER BY GROUP HAVING
INSERT INTO VALUES UPDATE SET DELETE TOP CASE WHEN THEN ELSE END EXISTS BETWEEN LIKE ASC DESC OUTPUT INSERTED DELETED WITH UPDLOCK HOLDLOCK ROWLOCK
NOLOCK COUNT SUM MIN MAX AVG COALESCE CAST CONVERT ISNULL OVER PARTITION ROW_NUMBER APPLY OFFSET ROWS FETCH NEXT ONLY LIMIT RETURNING TRUE FALSE
DATE INT VARCHAR NVARCHAR BIT DATETIME2 DECIMAL FLOAT MONTH DAY YEAR HOUR MINUTE SECOND IIF LEN LTRIM RTRIM UPPER LOWER REPLACE CONCAT STUFF
FOR XML PATH TYPE MERGE USING MATCHED TARGET SOURCE IF BEGIN TRAN COMMIT ROLLBACK DECLARE OBJECT_ID COL_LENGTH ALTER TABLE ADD CONSTRAINT DEFAULT
INDEX CREATE DROP PRIMARY KEY REFERENCES CASCADE NO ACTION LEFT RIGHT TRIM ABS ROUND FLOOR CEILING""".split())

SQL_DICA = re.compile(r"\b(SELECT|UPDATE|INSERT|DELETE|MERGE)\b|dbo\.", re.I)
UNIDADES = {"minute": "mins", "mi": "mins", "n": "mins", "day": "days", "dd": "days", "d": "days", "hour": "hours", "hh": "hours",
            "month": "months", "mm": "months", "second": "secs", "ss": "secs", "s": "secs", "week": "weeks", "wk": "weeks", "year": "years", "yy": "years"}
FMT = {"19": "'YYYY-MM-DD\"T\"HH24:MI:SS'", "16": "'YYYY-MM-DD\"T\"HH24:MI'", "10": "'YYYY-MM-DD'", "13": "'YYYY-MM-DD\"T\"HH24'", "7": "'YYYY-MM'", "5": "'HH24:MI'", "8": "'HH24:MI:SS'"}


def snake(n: str) -> str:
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", n)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return s.lower()


def separar(texto: str):
    """Divide um literal em pedaços SQL e trechos ${...} (que não são tocados)."""
    partes, i, ini = [], 0, 0
    while i < len(texto):
        if texto.startswith("${", i):
            partes.append(("sql", texto[ini:i]))
            prof, j = 0, i
            while j < len(texto):
                if texto[j] == "{":
                    prof += 1
                elif texto[j] == "}":
                    prof -= 1
                    if prof == 0:
                        break
                j += 1
            partes.append(("js", texto[i:j + 1]))
            i = ini = j + 1
            continue
        i += 1
    partes.append(("sql", texto[ini:]))
    return partes


def args(s: str, abre: int):
    """Argumentos de uma chamada a partir do '(' em `abre`. Devolve (lista, fim)."""
    prof, atual, lista, i = 0, "", [], abre
    while i < len(s):
        c = s[i]
        if c == "(":
            prof += 1
            if prof == 1:
                i += 1
                continue
        elif c == ")":
            prof -= 1
            if prof == 0:
                lista.append(atual)
                return lista, i
        elif c == "," and prof == 1:
            lista.append(atual)
            atual = ""
            i += 1
            continue
        elif c == "'" :
            j = s.index("'", i + 1)
            atual += s[i:j + 1]
            i = j + 1
            continue
        atual += c
        i += 1
    return None, None


def troca_funcoes(s: str, revisar: list) -> str:
    for nome in ("CONVERT", "DATEADD", "DATEDIFF", "CAST"):
        while True:
            m = re.search(r"\b" + nome + r"\s*\(", s, re.I)
            if not m:
                break
            a, fim = args(s, m.end() - 1)
            if a is None:
                revisar.append(f"{nome} sem fechar")
                break
            a = [x.strip() for x in a]
            novo = None
            if nome.upper() == "CONVERT":
                tipo = a[0].lower()
                mt = re.match(r"n?varchar\((\d+)\)", tipo)
                if mt and len(a) == 3 and a[2] in ("126", "120", "108") and mt.group(1) in FMT:
                    fmt = FMT[mt.group(1)] if a[2] != "108" else ("'HH24:MI'" if mt.group(1) == "5" else "'HH24:MI:SS'")
                    novo = f"to_char({a[1]}, {fmt})"
                elif mt and len(a) == 3 and a[2] == "103":
                    novo = f"to_char({a[1]}, 'DD/MM/YYYY')"
                elif tipo == "date" and len(a) == 2:
                    novo = f"({a[1]})::date"
                elif tipo in ("int", "bigint") and len(a) == 2:
                    novo = f"({a[1]})::{tipo}"
                elif mt and len(a) == 2:
                    novo = f"({a[1]})::text"
            elif nome.upper() == "CAST":
                mc = re.match(r"(.+)\s+AS\s+(\w+)(\(.*\))?$", a[0], re.I | re.S)
                if mc:
                    t = mc.group(2).lower()
                    destino = {"date": "date", "int": "int", "bigint": "bigint", "float": "float8", "nvarchar": "text", "varchar": "text", "bit": "boolean", "datetime2": "timestamptz", "decimal": "numeric"}.get(t)
                    if destino:
                        novo = f"({mc.group(1)})::{destino}"
            elif nome.upper() == "DATEADD" and len(a) == 3:
                u = UNIDADES.get(a[0].lower())
                if u:
                    novo = f"({a[2]} + make_interval({u} => ({a[1]})::int))"
            elif nome.upper() == "DATEDIFF" and len(a) == 3:
                u = a[0].lower()
                ini, fim2 = a[1], a[2]
                if u in ("minute", "mi", "n"):
                    novo = f"floor(extract(epoch from ({fim2}) - ({ini})) / 60)::int"
                elif u in ("second", "ss", "s"):
                    novo = f"floor(extract(epoch from ({fim2}) - ({ini})))::int"
                elif u in ("hour", "hh"):
                    novo = f"floor(extract(epoch from ({fim2}) - ({ini})) / 3600)::int"
                elif u in ("day", "dd", "d"):
                    novo = f"(({fim2})::date - ({ini})::date)"
            if novo is None:
                revisar.append(f"{nome}({', '.join(a)})")
                s = s[:m.start()] + nome.upper() + "\u0000" + s[m.end() - 1:]  # marca para não repetir
                continue
            s = s[:m.start()] + novo + s[fim + 1:]
    return s.replace("\u0000", "")


def apelidar_colunas_nuas(s: str) -> str:
    """SELECT Id, t.Pago FROM ... -> SELECT Id "Id", t.Pago "Pago": o JS continua lendo r.Id / r.Pago."""
    def lista(m):
        itens, prof, atual = [], 0, ""
        for c in m.group(2):
            if c == "(":
                prof += 1
            elif c == ")":
                prof -= 1
            if c == "," and prof == 0:
                itens.append(atual)
                atual = ""
            else:
                atual += c
        itens.append(atual)
        novos = []
        for it in itens:
            mm = re.match(r"^(\s*)((?:\w+\.)?([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*))(\s*)$", it)
            if mm and (mm.group(3) in COLUNAS):
                it = f'{mm.group(1)}{mm.group(2)} "{mm.group(3)}"{mm.group(4)}'
            novos.append(it)
        return m.group(1) + ",".join(novos) + m.group(3)
    return re.sub(r"(\bSELECT\s+(?:DISTINCT\s+)?(?:TOP\s*\(?\s*(?:\d+|@\w+)\s*\)?\s+)?)(.*?)(\s+FROM\b)", lista, s, flags=re.I | re.S)


def fora_de_aspas(s: str, fn) -> str:
    """Aplica fn só fora dos literais SQL ('...'); o conteúdo dos literais não muda."""
    partes = re.split(r"('(?:[^']|'')*')", s)
    return "".join(p if i % 2 else fn(p) for i, p in enumerate(partes))


def converter_sql(s: str, revisar: list) -> str:
    s = re.sub(r"\bN'", "'", s)
    s = re.sub(r"\b(SYSDATETIME|GETDATE|SYSUTCDATETIME)\s*\(\s*\)", "now()", s, flags=re.I)
    s = re.sub(r"\bISNULL\s*\(", "coalesce(", s, flags=re.I)
    s = re.sub(r"\bLEN\s*\(", "length(", s, flags=re.I)
    s = re.sub(r"\bLTRIM\s*\(\s*RTRIM\s*\(([^()]*)\)\s*\)", r"trim(\1)", s, flags=re.I)
    s = re.sub(r"\bRTRIM\s*\(\s*LTRIM\s*\(([^()]*)\)\s*\)", r"trim(\1)", s, flags=re.I)
    s = troca_funcoes(s, revisar)
    s = apelidar_colunas_nuas(s)
    # tabelas
    s = re.sub(r"\bdbo\.\[?(\w+)\]?", lambda m: TABELAS.get(m.group(1), "kart." + snake(m.group(1))), s)
    s = re.sub(r"\bINSERT\s+(kart\.)", r"INSERT INTO \1", s, flags=re.I)
    # identificadores: PascalCase conhecido -> snake; camelCase (apelido) -> "camelCase"
    def ident(m):
        antes, tok = m.group(1), m.group(2)
        if antes == "@" or tok.upper() in PALAVRAS and tok.isupper():
            return m.group(0)
        if re.match(r"^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*$", tok) and (tok in COLUNAS or tok in TABELAS):
            return antes + COLUNAS.get(tok, snake(tok))
        if re.match(r"^[a-z]+[A-Z]\w*$", tok):
            return antes + f'"{tok}"'
        if re.match(r"^[A-Z][a-z]", tok) and tok.upper() not in PALAVRAS:
            revisar.append(f"identificador desconhecido: {tok}")
        return m.group(0)
    s = fora_de_aspas(s, lambda t: re.sub(r"(\.)([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*)\b", lambda m: m.group(1) + COLUNAS.get(m.group(2), snake(m.group(2))),
                                         re.sub(r"(^|[^\w@\"'.])(\w+)(?![\w\"'])", ident, t)))
    # boolean
    def bit(m):
        col = m.group(2)
        if col in BITS:
            return f"{m.group(1)}{col} {m.group(3)} {'true' if m.group(4) == '1' else 'false'}"
        return m.group(0)
    s = re.sub(r"((?:\b\w+\.)?)(\w+)\s*(=|<>)\s*([01])\b(?!\.)", bit, s)
    # concatenação com literal
    s = re.sub(r"'\s*\+\s*", "' || ", s)
    s = re.sub(r"\s*\+\s*'", " || '", s)
    # TOP n no nível de topo
    mt = re.search(r"\bSELECT\s+(DISTINCT\s+)?TOP\s*\(?\s*(\d+|@\w+)\s*\)?\s+", s, re.I)
    if mt:
        prof = s[:mt.start()].count("(") - s[:mt.start()].count(")")
        if prof == 0:
            s = s[:mt.start()] + "SELECT " + (mt.group(1) or "") + s[mt.end():]
            s = s.rstrip()
            fim = s[len(s.rstrip(";")):]
            s = s.rstrip(";").rstrip() + f" limit {mt.group(2)}" + fim
        else:
            revisar.append("TOP em subconsulta")
    # OUTPUT inserted.X -> returning
    mo = re.search(r"\bOUTPUT\s+(.*?)(?=\s+(?:WHERE|VALUES|SELECT|FROM)\b|\s*$)", s, re.I | re.S)
    if mo:
        ret = re.sub(r"\b(inserted|deleted)\.", "", mo.group(1), flags=re.I)
        s = (s[:mo.start()] + s[mo.end():]).rstrip()
        s += f" returning {ret.strip()}"
    # WITH (UPDLOCK...)
    if re.search(r"WITH\s*\((?:\s*(?:UPDLOCK|HOLDLOCK|ROWLOCK|READPAST|NOLOCK)\s*,?)+\)", s, re.I):
        s = re.sub(r"\s*WITH\s*\((?:\s*(?:UPDLOCK|HOLDLOCK|ROWLOCK|READPAST|NOLOCK)\s*,?)+\)", "", s, flags=re.I)
        if re.match(r"\s*SELECT\b", s, re.I):
            s = s.rstrip() + " for update"
        revisar.append("trava (UPDLOCK/HOLDLOCK) trocada: conferir")
    for k in ("APPLY", "MERGE", "STUFF", "FOR XML", "OFFSET", "IIF(", "SELECT *", "@@", "TRY_CONVERT", "FORMAT("):
        if k.lower() in s.lower():
            revisar.append(k)
    return s


def processar(caminho: Path, aplicar: bool):
    src = caminho.read_text(encoding="utf-8")
    out, i, n_lits = [], 0, 0
    padrao = re.compile(r"`(?:\\.|\$\{(?:[^{}]|\{[^{}]*\})*\}|[^`\\])*`|'(?:\\.|[^'\\\n])*'")
    relatorio = []
    pos = 0
    for m in padrao.finditer(src):
        lit = m.group(0)
        corpo = lit[1:-1]
        if not SQL_DICA.search(corpo) or (lit[0] == "'" and not re.search(r"\b(SELECT|UPDATE|INSERT|DELETE)\b.*\b(FROM|SET|INTO|WHERE)\b|dbo\.", corpo, re.I)):
            continue
        revisar: list = []
        novo = "".join(converter_sql(t, revisar) if k == "sql" else t for k, t in separar(corpo)) if lit[0] == "`" else converter_sql(corpo, revisar)
        if novo != corpo or revisar:
            n_lits += 1
            linha = src.count("\n", 0, m.start()) + 1
            relatorio.append((linha, corpo, novo, revisar))
        out.append(src[pos:m.start()] + lit[0] + novo + lit[-1])
        pos = m.end()
    out.append(src[pos:])
    for linha, antes, depois, rev in relatorio:
        if rev:
            print(f"--- linha {linha}: REVISAR {sorted(set(rev))}\n    {depois.strip()[:400]}")
    print(f"\n{n_lits} trechos SQL convertidos; {sum(1 for r in relatorio if r[3])} para revisar.")
    if aplicar:
        caminho.write_text("".join(out), encoding="utf-8")


if __name__ == "__main__":
    processar(Path(sys.argv[1]), "--aplicar" in sys.argv)
