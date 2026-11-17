/**
 * Acesso ao banco operacional: Postgres, schema `kart` (Kartódromo OS na VPS, réplica no SRVKART).
 *
 * Datas: guardadas como timestamptz; a sessão roda em America/Sao_Paulo, então `now()` e
 * `to_char(x, 'YYYY-MM-DD"T"HH24:MI:SS')` devolvem o horário local de Brasília (o mesmo texto que o
 * banco anterior entregava). Ver `db-pg.ts` para o contrato do driver.
 * Conexão: OPS_PG_URL (usuário `ops_app`, senha no cofre).
 */
import { corrigeEmail } from './email-dominio';
import { normalizarInstagram } from './instagram';
import { nomeProprio } from '../nomes';
import { getPgPool, pgQuery, pgTx } from './db-pg';

type Params = Record<string, unknown>;

/** Formatos de data usados nas respostas (equivalentes ao CONVERT(...,126) do banco anterior). */
export const DATA_HORA = `'YYYY-MM-DD"T"HH24:MI:SS'`;
export const DATA = `'YYYY-MM-DD'`;

/** Nome de coluna/tabela do banco anterior (PascalCase) -> nome no Postgres (snake_case): 'PrecoCentavos' -> 'preco_centavos'. */
export function colPg(nome: string): string {
  return nome.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
/** Troca os identificadores PascalCase de um trecho SQL montado no código (ORDER BY 'LEN(Nome), Nome' etc.). */
export function sqlPg(trecho: string): string {
  return trecho.replace(/\bLEN\(/g, 'length(').replace(/\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*\b/g, (m) => colPg(m));
}

export function getPool() {
  return getPgPool();
}

export async function query<T = Record<string, unknown>>(text: string, params: Params = {}): Promise<T[]> {
  return pgQuery<T>(text, params);
}

export async function one<T = Record<string, unknown>>(text: string, params: Params = {}): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export async function tx<T>(fn: (run: (text: string, params?: Params) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
  return pgTx(fn);
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

export const CLIENTE_COLS = `c.id, c.nome, c.tipo_documento "tipoDocumento", c.documento, c.email, c.instagram, c.telefone,
  to_char(c.nascimento, ${DATA}) nascimento, c.sexo, c.peso, c.cep, c.endereco, c.numero,
  c.complemento, c.bairro, c.cidade, c.estado, c.responsavel_id "responsavelId",
  to_char(c.lgpd_aceite_em, ${DATA_HORA}) "lgpdAceiteEm", c.bloqueado, c.observacao, c.origem, c.tipo_sanguineo "tipoSanguineo", c.ibge, c.pais,
  to_char(c.criado_em, ${DATA_HORA}) "criadoEm"`;

export type ClienteInput = {
  nome?: string;
  tipoDocumento?: string;
  documento?: string | null;
  email?: string | null;
  instagram?: string | null;
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
  nome: ['nome', 200],
  tipoDocumento: ['tipo_documento', 20],
  documento: ['documento', 60],
  email: ['email', 200],
  instagram: ['instagram', 31],
  telefone: ['telefone', 40],
  cep: ['cep', 12],
  endereco: ['endereco', 200],
  numero: ['numero', 20],
  complemento: ['complemento', 100],
  bairro: ['bairro', 100],
  cidade: ['cidade', 100],
  estado: ['estado', 4],
  observacao: ['observacao', 400],
  tipoSanguineo: ['tipo_sanguineo', 3],
  ibge: ['ibge', 10],
  pais: ['pais', 60],
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
    if (key === 'instagram' && typeof v === 'string') v = normalizarInstagram(v);
    if (typeof v === 'string') v = v.trim().slice(0, max);
    if (key === 'email' && typeof v === 'string') v = corrigeEmail(v); // minúsculo + "gmal.com" → "gmail.com"
    if (key === 'nome' && typeof v === 'string') v = nomeProprio(v); // "joao victor" / "JOAO VICTOR" → "Joao Victor"
    if (key === 'estado' && typeof v === 'string') v = v.toUpperCase();
    set(col, v);
  }
  if ('documento' in input) set('documento_num', onlyDigits(input.documento).slice(0, 30) || null);
  if ('telefone' in input) set('telefone_num', onlyDigits(input.telefone).slice(-20) || null);
  if ('nascimento' in input) set('nascimento', /^\d{4}-\d{2}-\d{2}$/.test(String(input.nascimento ?? '')) ? input.nascimento : null);
  if ('sexo' in input) set('sexo', input.sexo === 'M' || input.sexo === 'F' ? input.sexo : null);
  if ('peso' in input) {
    const p = Number(String(input.peso ?? '').replace(',', '.'));
    set('peso', p > 0 && p < 500 ? p : null);
  }
  if ('responsavelId' in input) set('responsavel_id', input.responsavelId ? Number(input.responsavelId) : null);
  if ('bloqueado' in input) out.bloqueado = !!input.bloqueado;
  return out;
}

export async function insertCliente(input: ClienteInput, origem: string): Promise<number> {
  const cols = clienteColumns(input, false);
  if (!cols.nome) throw new Error('Nome e obrigatorio.');
  cols.origem = origem;
  const names = Object.keys(cols);
  const params = Object.fromEntries(names.map((n) => [n, cols[n]]));
  const lgpd = input.lgpd ? ', lgpd_aceite_em' : '';
  const lgpdV = input.lgpd ? ', now()' : '';
  const row = await one<{ id: number }>(
    `insert into kart.cliente (${names.join(', ')}${lgpd}) values (${names.map((n) => '@' + n).join(', ')}${lgpdV}) returning id`,
    params,
  );
  return row!.id;
}

export async function updateCliente(id: number, input: ClienteInput, partial: boolean) {
  const cols = clienteColumns(input, partial);
  if ('nome' in cols && !cols.nome) throw new Error('Nome e obrigatorio.');
  const sets = Object.keys(cols).map((n) => `${n} = @${n}`);
  if (input.lgpd) sets.push('lgpd_aceite_em = coalesce(lgpd_aceite_em, now())');
  await query(`update kart.cliente set ${sets.join(', ')} where id = @id`, { ...cols, id });
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
