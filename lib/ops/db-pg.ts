/**
 * Driver Postgres do banco operacional (schema `kart` no Supabase da VPS ou na réplica do SRVKART).
 *
 * Mantém o contrato do driver SQL Server (`query`/`one`/`tx` com parâmetros nomeados `@nome`):
 * - `@nome` vira `$n` (fora de strings e comentários); o mesmo nome reaproveita o mesmo `$n`;
 * - a sessão roda em America/Sao_Paulo e com search_path `kart`, então `now()` e `to_char` dão a
 *   hora local de Brasília como o SYSDATETIME()/CONVERT(...,126) davam;
 * - bigint/numeric voltam como number e timestamptz/date voltam como Date "relógio de parede em UTC",
 *   do mesmo jeito que o driver mssql entregava (useUTC), para as respostas HTTP não mudarem.
 */
import pg from 'pg';

type Params = Record<string, unknown>;

const TZ = 'America/Sao_Paulo';

pg.types.setTypeParser(20, (v) => Number(v)); // int8
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(1082, (v) => new Date(`${v}T00:00:00Z`)); // date
const paredeUtc = (v: string) => {
  // '2025-02-25 22:15:00-03' (sessão em São Paulo) -> Date com o relógio de parede em UTC.
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(v);
  return m ? new Date(`${m[1]}T${m[2]}Z`) : new Date(v);
};
pg.types.setTypeParser(1184, paredeUtc); // timestamptz
pg.types.setTypeParser(1114, paredeUtc); // timestamp

let pool: pg.Pool | null = null;

export function getPgPool(): pg.Pool {
  if (pool) return pool;
  const env = process.env;
  pool = new pg.Pool({
    connectionString: env.OPS_PG_URL,
    max: Number(env.OPS_PG_POOL_MAX || 10),
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000,
    options: `-c timezone=${TZ} -c search_path=kart,public`,
    ssl: env.OPS_PG_SSL === 'true' ? { rejectUnauthorized: env.OPS_PG_SSL_VERIFY !== 'false' } : undefined,
  });
  pool.on('error', () => {
    /* conexão ociosa caiu: o pool abre outra na próxima query */
  });
  return pool;
}

/** Troca `@nome` por `$n`, ignorando strings ('...'), identificadores ("...") e comentários. */
export function paraPosicional(text: string, params: Params): { text: string; values: unknown[] } {
  const ordem: string[] = [];
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      const fim = text.indexOf(ch, i + 1);
      const j = fim < 0 ? text.length : fim + 1;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '-' && text[i + 1] === '-') {
      const fim = text.indexOf('\n', i);
      const j = fim < 0 ? text.length : fim;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '@' && /[A-Za-z_]/.test(text[i + 1] ?? '')) {
      let j = i + 1;
      while (j < text.length && /\w/.test(text[j])) j++;
      const nome = text.slice(i + 1, j);
      if (!(nome in params)) throw new Error(`Parâmetro @${nome} usado na query mas não informado.`);
      let n = ordem.indexOf(nome);
      if (n < 0) n = ordem.push(nome) - 1;
      out += `$${n + 1}`;
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return { text: out, values: ordem.map((n) => normalizar(params[n])) };
}

function normalizar(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) {
    // o código sempre trata Date como relógio de parede em UTC (padrão do driver mssql)
    return v.toISOString().slice(0, 23).replace('T', ' ');
  }
  return v;
}

export async function pgQuery<T = Record<string, unknown>>(text: string, params: Params = {}): Promise<T[]> {
  const q = paraPosicional(text, params);
  return (await getPgPool().query(q.text, q.values)).rows as T[];
}

export async function pgTx<T>(fn: (run: (text: string, params?: Params) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
  const cli = await getPgPool().connect();
  try {
    await cli.query('begin');
    const run = async (text: string, params: Params = {}) => {
      const q = paraPosicional(text, params);
      return (await cli.query(q.text, q.values)).rows ?? [];
    };
    const out = await fn(run);
    await cli.query('commit');
    return out;
  } catch (err) {
    await cli.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    cli.release();
  }
}
