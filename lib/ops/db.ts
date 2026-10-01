/**
 * Acesso ao banco operacional KartodromoOps (SRVKART\SQLEXPRESS).
 *
 * Datas: as colunas DATETIME2 guardam horario LOCAL de Brasilia (igual ao LapTime). Pra nao
 * brigar com fuso no driver, toda data sai do banco ja como texto 'YYYY-MM-DDTHH:mm:ss' via
 * CONVERT(...,126) e entra como texto, e "agora" e sempre SYSDATETIME() do servidor SQL.
 */
import sql from 'mssql';
import { corrigeEmail } from './email-dominio';
import { nomeProprio } from '../nomes';

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  const env = process.env;
  pool = await new sql.ConnectionPool({
    server: env.OPS_SQL_SERVER || '127.0.0.1',
    database: env.OPS_SQL_DATABASE || 'KartodromoOps',
    user: env.OPS_SQL_USER,
    password: env.OPS_SQL_PASSWORD,
    options: { instanceName: env.OPS_SQL_INSTANCE || 'SQLEXPRESS', encrypt: false, trustServerCertificate: true },
    pool: { max: 10, idleTimeoutMillis: 60_000 },
    requestTimeout: 30_000,
  }).connect();
  return pool;
}

type Params = Record<string, unknown>;

export async function query<T = Record<string, unknown>>(text: string, params: Params = {}): Promise<T[]> {
  const req = (await getPool()).request();
  for (const [k, v] of Object.entries(params)) req.input(k, v as never);
  return (await req.query(text)).recordset as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params: Params = {}): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export async function tx<T>(fn: (run: (text: string, params?: Params) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
  const t = new sql.Transaction(await getPool());
  await t.begin();
  try {
    const run = async (text: string, params: Params = {}) => {
      const req = new sql.Request(t);
      for (const [k, v] of Object.entries(params)) req.input(k, v as never);
      return (await req.query(text)).recordset ?? [];
    };
    const out = await fn(run);
    await t.commit();
    return out;
  } catch (err) {
    await t.rollback().catch(() => undefined);
    throw err;
  }
}

export const onlyDigits = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '') : '');

/** Valida CPF pelos digitos verificadores. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export const CLIENTE_COLS = `c.Id id, c.Nome nome, c.TipoDocumento tipoDocumento, c.Documento documento, c.Email email, c.Telefone telefone,
  CONVERT(varchar(10), c.Nascimento, 126) nascimento, c.Sexo sexo, c.Peso peso, c.Cep cep, c.Endereco endereco, c.Numero numero,
  c.Complemento complemento, c.Bairro bairro, c.Cidade cidade, c.Estado estado, c.ResponsavelId responsavelId,
  CONVERT(varchar(19), c.LgpdAceiteEm, 126) lgpdAceiteEm, c.Bloqueado bloqueado, c.Observacao observacao, c.Origem origem, c.TipoSanguineo tipoSanguineo, c.Ibge ibge, c.Pais pais,
  CONVERT(varchar(19), c.CriadoEm, 126) criadoEm`;

export type ClienteInput = {
  nome?: string;
  tipoDocumento?: string;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  nascimento?: string | null;
  sexo?: string | null;
  peso?: number | string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  responsavelId?: number | null;
  lgpd?: boolean;
  bloqueado?: boolean;
  observacao?: string | null;
  tipoSanguineo?: string | null;
  ibge?: string | null;
  pais?: string | null;
};

const FIELD_MAP: Record<string, [string, number]> = {
  nome: ['Nome', 200],
  tipoDocumento: ['TipoDocumento', 20],
  documento: ['Documento', 60],
  email: ['Email', 200],
  telefone: ['Telefone', 40],
  cep: ['Cep', 12],
  endereco: ['Endereco', 200],
  numero: ['Numero', 20],
  complemento: ['Complemento', 100],
  bairro: ['Bairro', 100],
  cidade: ['Cidade', 100],
  estado: ['Estado', 4],
  observacao: ['Observacao', 400],
  tipoSanguineo: ['TipoSanguineo', 3],
  ibge: ['Ibge', 10],
  pais: ['Pais', 60],
};

/**
 * Normaliza um input de cliente em pares coluna->valor. `partial` = so grava o que veio
 * preenchido (usado pelo totem, onde campo vazio significa "nao mudou").
 */
export function clienteColumns(input: ClienteInput, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (col: string, value: unknown) => {
    if (partial && (value === null || value === undefined || value === '')) return;
    out[col] = value === '' ? null : value;
  };
  for (const [key, [col, max]] of Object.entries(FIELD_MAP)) {
    if (!(key in input)) continue;
    let v = (input as Record<string, unknown>)[key];
    if (typeof v === 'string') v = v.trim().slice(0, max);
    if (key === 'email' && typeof v === 'string') v = corrigeEmail(v); // minúsculo + "gmal.com" → "gmail.com"
    if (key === 'nome' && typeof v === 'string') v = nomeProprio(v); // "joao victor" / "JOAO VICTOR" → "Joao Victor"
    if (key === 'estado' && typeof v === 'string') v = v.toUpperCase();
    set(col, v);
  }
  if ('documento' in input) set('DocumentoNum', onlyDigits(input.documento).slice(0, 30) || null);
  if ('telefone' in input) set('TelefoneNum', onlyDigits(input.telefone).slice(-20) || null);
  if ('nascimento' in input) set('Nascimento', /^\d{4}-\d{2}-\d{2}$/.test(String(input.nascimento ?? '')) ? input.nascimento : null);
  if ('sexo' in input) set('Sexo', input.sexo === 'M' || input.sexo === 'F' ? input.sexo : null);
  if ('peso' in input) {
    const p = Number(String(input.peso ?? '').replace(',', '.'));
    set('Peso', p > 0 && p < 500 ? p : null);
  }
  if ('responsavelId' in input) set('ResponsavelId', input.responsavelId ? Number(input.responsavelId) : null);
  if ('bloqueado' in input) out.Bloqueado = input.bloqueado ? 1 : 0;
  return out;
}

export async function insertCliente(input: ClienteInput, origem: string): Promise<number> {
  const cols = clienteColumns(input, false);
  if (!cols.Nome) throw new Error('Nome e obrigatorio.');
  cols.Origem = origem;
  const names = Object.keys(cols);
  const params = Object.fromEntries(names.map((n) => [n, cols[n]]));
  const lgpd = input.lgpd ? ', LgpdAceiteEm' : '';
  const lgpdV = input.lgpd ? ', SYSDATETIME()' : '';
  const row = await one<{ id: number }>(
    `INSERT INTO dbo.Cliente (${names.join(', ')}${lgpd}) OUTPUT inserted.Id id VALUES (${names.map((n) => '@' + n).join(', ')}${lgpdV})`,
    params,
  );
  return row!.id;
}

export async function updateCliente(id: number, input: ClienteInput, partial: boolean) {
  const cols = clienteColumns(input, partial);
  if ('Nome' in cols && !cols.Nome) throw new Error('Nome e obrigatorio.');
  const sets = Object.keys(cols).map((n) => `${n} = @${n}`);
  if (input.lgpd) sets.push('LgpdAceiteEm = COALESCE(LgpdAceiteEm, SYSDATETIME())');
  sets.push('AtualizadoEm = SYSDATETIME()');
  await query(`UPDATE dbo.Cliente SET ${sets.join(', ')} WHERE Id = @id`, { ...cols, id });
}

/** Precos em centavos (tabela passada pelo dono em 25/09/2026). Sobrescreviveis por env. */
export function precos() {
  const env = process.env;
  return {
    antecipado: Number(env.OPS_PRECO_ANTECIPADO || 14500),
    balcao: Number(env.OPS_PRECO_BALCAO || 17500),
    super: Number(env.OPS_PRECO_SUPER || 17500),
  };
}
