/**
 * Patrocinadores e publicidade do painel administrativo (outdoor, pódio, contratos, cobranças).
 *
 * Diferente do resto do painel, estes dados ficam no D1 `kartodromo-admin` (não no KartodromoOps do SRVKART):
 * não são dados da operação da pista e assim nada precisa ser publicado nas máquinas do kartódromo.
 * O login é o mesmo da Recepção: o token é validado no servidor da operação e só quem é administrador entra.
 */

type Linha = Record<string, unknown>;

export type D1Stmt = {
  bind: (...v: unknown[]) => D1Stmt;
  all: <T = Linha>() => Promise<{ results: T[] }>;
  first: <T = Linha>() => Promise<T | null>;
  run: () => Promise<{ meta: { changes?: number } }>;
};
export type D1Db = { prepare: (q: string) => D1Stmt; batch: (s: D1Stmt[]) => Promise<unknown[]> };

export interface PatroEnv {
  OPS_URL: string;
  KARTODROMO_ADMIN_DB?: D1Db;
}

const SEGURANCA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
};

export const PATRO_MAX_BYTES = 8 * 1024 * 1024;
const PARTE = 600_000; // caracteres base64 por linha (múltiplo de 4); o D1 aceita ~2 MB por linha
const MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const CATEGORIAS = ['logo', 'arte', 'contrato', 'foto', 'outro'];

const RECURSOS = {
  empresas: {
    tabela: 'patro_empresas',
    colunas: ['nome', 'razao_social', 'cnpj', 'segmento', 'contato_nome', 'email', 'telefone', 'site', 'endereco', 'observacoes', 'logo_arquivo_id', 'ativo'],
    booleanas: ['ativo'],
    obrigatorias: ['nome'],
  },
  espacos: {
    tabela: 'patro_espacos',
    colunas: ['nome', 'tipo', 'localizacao', 'dimensoes', 'descricao', 'valor_tabela', 'foto_arquivo_id', 'ativo'],
    booleanas: ['ativo'],
    obrigatorias: ['nome'],
  },
  contratos: {
    tabela: 'patro_contratos',
    colunas: ['empresa_id', 'espaco_id', 'titulo', 'status', 'valor', 'recorrencia', 'dia_vencimento', 'data_inicio', 'data_fim', 'renovacao_automatica', 'arte_arquivo_id', 'contrato_arquivo_id', 'observacoes'],
    booleanas: ['renovacao_automatica'],
    obrigatorias: ['empresa_id', 'titulo', 'data_inicio'],
  },
  cobrancas: {
    tabela: 'patro_cobrancas',
    colunas: ['status', 'pago_em', 'forma_pagamento', 'observacoes', 'valor', 'vencimento'],
    booleanas: [] as string[],
    obrigatorias: [] as string[],
  },
} as const;

type NomeRecurso = keyof typeof RECURSOS;

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA, ...extra } });

class ErroHttp extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

// ------------------------------------------------------------------ autenticação (login da Recepção)

const cacheSessoes = new Map<string, { quem: { nome: string; admin: boolean }; ate: number }>();

function lerPayload(token: string): { nome: string; admin: boolean; exp: number } | null {
  try {
    const bruto = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(bruto), (c) => c.charCodeAt(0)))) as { nome?: string; admin?: boolean; exp?: number };
    return typeof p.exp === 'number' ? { nome: String(p.nome ?? ''), admin: Boolean(p.admin), exp: p.exp } : null;
  } catch {
    return null;
  }
}

/** O token é validado pelo servidor da operação; só depois disso nome e perfil são confiáveis. */
export async function autenticar(req: Request, env: PatroEnv): Promise<{ nome: string; admin: boolean }> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new ErroHttp(401, 'Entre no painel para continuar.');
  const agora = Date.now();
  const guardado = cacheSessoes.get(token);
  if (guardado && guardado.ate > agora) return guardado.quem;

  const dados = lerPayload(token);
  if (!dados || dados.exp <= agora) throw new ErroHttp(401, 'Sua sessão terminou. Entre de novo.');
  const ops = async (caminho: string) => {
    try {
      return await fetch(new URL(caminho, env.OPS_URL).toString(), { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new ErroHttp(502, 'O servidor do kartódromo não respondeu. Confira a internet do kartódromo.');
    }
  };
  // O servidor da operação confirma o login e diz se a pessoa é administradora (a mesma rota que o painel usa).
  let resp = await ops('/api/office/minhas-permissoes');
  if (resp.status === 404) resp = await ops('/api/office/apoio'); // servidor antigo, sem permissões por perfil
  if (resp.status === 401) throw new ErroHttp(401, 'Sua sessão terminou. Entre de novo.');
  if (resp.status >= 500) throw new ErroHttp(502, 'Não deu para confirmar o seu login agora. Tente de novo.');
  if (!resp.ok) throw new ErroHttp(403, 'Seu perfil não tem acesso aos patrocinadores.');
  const perm = (await resp.json().catch(() => null)) as { admin?: unknown; acessoTotal?: unknown } | null;
  const admin = perm && typeof perm.admin === 'boolean' ? perm.admin : dados.admin;
  const quem = { nome: dados.nome, admin };
  if (cacheSessoes.size > 200) cacheSessoes.clear();
  cacheSessoes.set(token, { quem, ate: agora + 60_000 });
  return quem;
}

// ------------------------------------------------------------------ vencimentos

const MESES: Record<string, number> = { unico: 0, mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
const HORIZONTE_MESES = 12;

/** Datas de vencimento (AAAA-MM-DD). Sem data final, programa os próximos 12 meses. */
export function vencimentos(c: { data_inicio: string; data_fim?: string | null; recorrencia: string; dia_vencimento: number }): string[] {
  const passo = MESES[c.recorrencia];
  if (passo === undefined) throw new ErroHttp(400, 'Recorrência inválida.');
  const inicio = new Date(`${c.data_inicio}T00:00:00Z`);
  if (Number.isNaN(inicio.getTime())) throw new ErroHttp(400, 'Data de início inválida.');
  const dia = Math.min(Math.max(Math.trunc(c.dia_vencimento) || 1, 1), 28);
  const ano = inicio.getUTCFullYear();
  const mes = inicio.getUTCMonth() + (dia < inicio.getUTCDate() ? 1 : 0);
  const formatar = (m: number) => new Date(Date.UTC(ano, m, dia)).toISOString().slice(0, 10);
  if (passo === 0) return [formatar(mes)];
  const limite = c.data_fim || formatar(mes + HORIZONTE_MESES);
  const datas: string[] = [];
  for (let i = 0; i < 600; i += 1) {
    const d = formatar(mes + i * passo);
    if (d > limite) break;
    datas.push(d);
  }
  return datas;
}

// ------------------------------------------------------------------ dados

function limpar(nome: NomeRecurso, corpo: unknown, parcial: boolean): Linha {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroHttp(400, 'Dados inválidos.');
  const cfg = RECURSOS[nome];
  const colunas = cfg.colunas as readonly string[];
  const booleanas = cfg.booleanas as readonly string[];
  const saida: Linha = {};
  for (const [k, v] of Object.entries(corpo as Linha)) {
    if (k === 'id') continue;
    if (!colunas.includes(k)) throw new ErroHttp(400, `Campo inválido: ${k}`);
    saida[k] = booleanas.includes(k) ? (v ? 1 : 0) : typeof v === 'string' && v.trim() === '' ? null : v;
  }
  if (!parcial) {
    for (const k of cfg.obrigatorias as readonly string[]) if (saida[k] == null) throw new ErroHttp(400, `Preencha o campo ${k}.`);
  }
  return saida;
}

async function auditar(db: D1Db, ator: string, acao: string, entidade: string, id: string | null, detalhes?: unknown) {
  await db.prepare('INSERT INTO audit_log (actor, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)')
    .bind(ator, acao, entidade, id, detalhes === undefined ? null : JSON.stringify(detalhes)).run();
}

async function tudo(db: D1Db) {
  const [empresas, espacos, contratos, cobrancas] = await Promise.all([
    db.prepare('SELECT * FROM patro_empresas ORDER BY nome').all(),
    db.prepare('SELECT * FROM patro_espacos ORDER BY nome').all(),
    db.prepare('SELECT * FROM patro_contratos_full ORDER BY data_inicio DESC').all(),
    db.prepare('SELECT * FROM patro_cobrancas_full ORDER BY vencimento').all(),
  ]);
  return { empresas: empresas.results, espacos: espacos.results, contratos: contratos.results, cobrancas: cobrancas.results };
}

async function criar(db: D1Db, nome: Exclude<NomeRecurso, 'cobrancas'>, corpo: unknown, ator: string) {
  const dados = limpar(nome, corpo, false);
  if (nome === 'contratos') await validarContrato(db, dados, null);
  const id = crypto.randomUUID();
  const chaves = ['id', ...Object.keys(dados)];
  await db.prepare(`INSERT INTO ${RECURSOS[nome].tabela} (${chaves.join(',')}) VALUES (${chaves.map(() => '?').join(',')})`)
    .bind(id, ...Object.values(dados)).run();
  await auditar(db, ator, 'create', RECURSOS[nome].tabela, id, dados);
  return db.prepare(`SELECT * FROM ${RECURSOS[nome].tabela} WHERE id = ?`).bind(id).first();
}

async function atualizar(db: D1Db, nome: NomeRecurso, id: string, corpo: unknown, ator: string) {
  const dados = limpar(nome, corpo, true);
  const chaves = Object.keys(dados);
  if (!chaves.length) throw new ErroHttp(400, 'Nada para atualizar.');
  if (nome === 'contratos') await validarContrato(db, dados, id);
  const extra = nome === 'empresas' || nome === 'contratos' ? ", updated_at = datetime('now')" : '';
  const r = await db.prepare(`UPDATE ${RECURSOS[nome].tabela} SET ${chaves.map((k) => `${k} = ?`).join(', ')}${extra} WHERE id = ?`).bind(...Object.values(dados), id).run();
  if (!r.meta.changes) throw new ErroHttp(404, 'Registro não encontrado.');
  await auditar(db, ator, 'update', RECURSOS[nome].tabela, id, dados);
  return db.prepare(`SELECT * FROM ${RECURSOS[nome].tabela} WHERE id = ?`).bind(id).first();
}

/** Um espaço não pode ter dois contratos ativos ao mesmo tempo. */
async function validarContrato(db: D1Db, dados: Linha, id: string | null) {
  const atual = id ? await db.prepare('SELECT * FROM patro_contratos WHERE id = ?').bind(id).first() : null;
  const c = { ...(atual ?? {}), ...dados } as Linha;
  if (c.data_fim && String(c.data_fim) < String(c.data_inicio)) throw new ErroHttp(400, 'A data final não pode ser antes do início.');
  if (c.status !== 'ativo' || !c.espaco_id) return;
  const outro = await db.prepare(
    `SELECT e.nome AS empresa, c.data_inicio, c.data_fim FROM patro_contratos c LEFT JOIN patro_empresas e ON e.id = c.empresa_id
     WHERE c.espaco_id = ? AND c.status = 'ativo' AND c.id != ? AND (c.data_fim IS NULL OR c.data_fim >= ?) AND (? IS NULL OR c.data_inicio <= ?) LIMIT 1`,
  ).bind(c.espaco_id, id ?? '', c.data_inicio, c.data_fim ?? null, c.data_fim ?? null).first<{ empresa: string; data_inicio: string; data_fim: string | null }>();
  if (outro) throw new ErroHttp(409, `Esse espaço já está contratado por ${outro.empresa ?? 'outra empresa'} nesse período.`);
}

async function gerarCobrancas(db: D1Db, contratoId: string, ator: string) {
  const c = await db.prepare('SELECT * FROM patro_contratos WHERE id = ?').bind(contratoId).first<Linha>();
  if (!c) throw new ErroHttp(404, 'Contrato não encontrado.');
  if (c.status === 'cancelado') throw new ErroHttp(409, 'Contrato cancelado não gera cobranças.');
  const datas = vencimentos({ data_inicio: String(c.data_inicio), data_fim: c.data_fim ? String(c.data_fim) : null, recorrencia: String(c.recorrencia), dia_vencimento: Number(c.dia_vencimento) });
  const existentes = (await db.prepare('SELECT parcela, vencimento FROM patro_cobrancas WHERE contrato_id = ?').bind(contratoId).all<{ parcela: number; vencimento: string }>()).results;
  const jaTem = new Set(existentes.map((e) => e.vencimento));
  let parcela = existentes.reduce((m, e) => Math.max(m, e.parcela), 0);
  const novas = datas.filter((d) => !jaTem.has(d));
  const comandos = novas.map((d) => {
    parcela += 1;
    return db.prepare('INSERT INTO patro_cobrancas (id, contrato_id, parcela, vencimento, valor) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), contratoId, parcela, d, Number(c.valor));
  });
  for (let i = 0; i < comandos.length; i += 100) await db.batch(comandos.slice(i, i + 100));
  await auditar(db, ator, 'gerar_cobrancas', 'patro_contratos', contratoId, { geradas: novas.length });
  return { geradas: novas.length, total: datas.length };
}

// ------------------------------------------------------------------ arquivos

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function guardarArquivo(db: D1Db, req: Request, ator: string) {
  const form = await req.formData().catch(() => null);
  const arquivo = form?.get('file');
  if (!form || !(arquivo instanceof File)) throw new ErroHttp(400, 'Escolha um arquivo.');
  if (!MIMES.includes(arquivo.type)) throw new ErroHttp(415, 'Tipo de arquivo não aceito. Use imagem (PNG, JPG, WEBP), PDF ou DOCX.');
  if (arquivo.size === 0 || arquivo.size > PATRO_MAX_BYTES) throw new ErroHttp(413, 'O arquivo está vazio ou passa de 8 MB.');
  const categoria = String(form.get('categoria') || 'outro');
  if (!CATEGORIAS.includes(categoria)) throw new ErroHttp(400, 'Categoria inválida.');
  const texto = base64(new Uint8Array(await arquivo.arrayBuffer()));
  const id = crypto.randomUUID();
  const nome = (arquivo.name || 'arquivo').slice(0, 200);
  const comandos = [db.prepare('INSERT INTO patro_arquivos (id, nome, mime, tamanho, categoria) VALUES (?, ?, ?, ?, ?)').bind(id, nome, arquivo.type, arquivo.size, categoria)];
  for (let seq = 0, i = 0; i < texto.length; seq += 1, i += PARTE) {
    comandos.push(db.prepare('INSERT INTO patro_arquivo_partes (arquivo_id, seq, dados) VALUES (?, ?, ?)').bind(id, seq, texto.slice(i, i + PARTE)));
  }
  await db.batch(comandos);
  await auditar(db, ator, 'upload', 'patro_arquivos', id, { nome, tamanho: arquivo.size });
  return { id, nome, mime: arquivo.type, tamanho: arquivo.size, categoria };
}

async function lerArquivo(db: D1Db, id: string): Promise<Response> {
  const meta = await db.prepare('SELECT nome, mime FROM patro_arquivos WHERE id = ?').bind(id).first<{ nome: string; mime: string }>();
  if (!meta) throw new ErroHttp(404, 'Arquivo não encontrado.');
  const partes = (await db.prepare('SELECT dados FROM patro_arquivo_partes WHERE arquivo_id = ? ORDER BY seq').bind(id).all<{ dados: string }>()).results;
  const bin = atob(partes.map((p) => p.dados).join(''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: { 'content-type': meta.mime, 'content-disposition': `inline; filename="${meta.nome.replace(/["\r\n\\]/g, '_')}"`, 'cache-control': 'private, max-age=300', ...SEGURANCA },
  });
}

async function removerArquivo(db: D1Db, id: string, ator: string) {
  await db.batch([
    db.prepare('DELETE FROM patro_arquivo_partes WHERE arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_empresas SET logo_arquivo_id = NULL WHERE logo_arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_espacos SET foto_arquivo_id = NULL WHERE foto_arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_contratos SET arte_arquivo_id = NULL WHERE arte_arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_contratos SET contrato_arquivo_id = NULL WHERE contrato_arquivo_id = ?').bind(id),
    db.prepare('DELETE FROM patro_arquivos WHERE id = ?').bind(id),
  ]);
  await auditar(db, ator, 'delete', 'patro_arquivos', id);
  return { ok: true };
}

// ------------------------------------------------------------------ rotas

/** Trata /api/patro/*. */
export async function tratarPatrocinadores(req: Request, env: PatroEnv, url: URL): Promise<Response> {
  try {
    const quem = await autenticar(req, env);
    if (!quem.admin) throw new ErroHttp(403, 'Só administradores acessam os patrocinadores.');
    const db = env.KARTODROMO_ADMIN_DB;
    if (!db) throw new ErroHttp(503, 'O banco dos patrocinadores não está ligado a este painel.');

    const [, , , recurso, id, acao] = url.pathname.split('/'); // ['', 'api', 'patro', recurso, id, acao]
    const m = req.method;

    if (recurso === 'tudo' && m === 'GET') return json(200, await tudo(db));

    if (recurso === 'arquivos') {
      if (!id && m === 'POST') return json(201, await guardarArquivo(db, req, quem.nome));
      if (id && m === 'GET') return await lerArquivo(db, id);
      if (id && m === 'DELETE') return json(200, await removerArquivo(db, id, quem.nome));
      throw new ErroHttp(405, 'Método não permitido.');
    }

    if (recurso === 'contratos' && id && acao === 'cobrancas' && m === 'POST') return json(200, await gerarCobrancas(db, id, quem.nome));

    if (recurso && recurso in RECURSOS) {
      const nome = recurso as NomeRecurso;
      if (m === 'POST' && !id && nome !== 'cobrancas') return json(201, await criar(db, nome, await req.json().catch(() => null), quem.nome));
      if (m === 'PATCH' && id) return json(200, await atualizar(db, nome, id, await req.json().catch(() => null), quem.nome));
      if (m === 'DELETE' && id && nome !== 'cobrancas') {
        const r = await db.prepare(`DELETE FROM ${RECURSOS[nome].tabela} WHERE id = ?`).bind(id).run();
        if (!r.meta.changes) throw new ErroHttp(404, 'Registro não encontrado.');
        await auditar(db, quem.nome, 'delete', RECURSOS[nome].tabela, id);
        return json(200, { ok: true });
      }
    }
    throw new ErroHttp(404, 'Rota não encontrada.');
  } catch (e) {
    if (e instanceof ErroHttp) return json(e.status, { error: e.message });
    console.error('[patrocinadores]', e);
    return json(500, { error: 'Erro inesperado nos patrocinadores.' });
  }
}
