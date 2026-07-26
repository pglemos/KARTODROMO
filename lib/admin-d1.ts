import { NextRequest, NextResponse } from 'next/server';

type Row = Record<string, unknown>;

export type AdminD1Statement = {
  bind: (...values: unknown[]) => AdminD1Statement;
  all: <T extends Row = Row>() => Promise<{ results: T[] }>;
  first: <T extends Row = Row>() => Promise<T | null>;
  run: () => Promise<{ meta: { changes?: number } }>;
};

export type AdminD1Database = {
  prepare: (query: string) => AdminD1Statement;
  batch: (statements: AdminD1Statement[]) => Promise<unknown[]>;
};

type ResourceConfig = {
  columns: readonly string[];
  booleans?: readonly string[];
  json?: readonly string[];
  search?: readonly string[];
  defaultOrder?: string;
  defaultDir?: 'asc' | 'desc';
  dateColumn?: string;
  readOnly?: boolean;
};

const resources = {
  profiles: { columns: ['id', 'email', 'full_name', 'role', 'phone', 'active', 'created_at'], booleans: ['active'], search: ['email', 'full_name', 'phone'], defaultOrder: 'full_name' },
  audit_log: { columns: ['id', 'actor', 'action', 'entity', 'entity_id', 'details', 'created_at'], json: ['details'], search: ['actor', 'action', 'entity'], defaultOrder: 'created_at', defaultDir: 'desc', readOnly: true },
  clientes: { columns: ['id', 'nome', 'email', 'telefone', 'cpf', 'cidade', 'estado', 'created_at', 'notes'], search: ['nome', 'email', 'telefone', 'cpf'], defaultOrder: 'nome' },
  pistas: { columns: ['id', 'nome', 'descricao', 'ativa'], booleans: ['ativa'], search: ['nome', 'descricao'], defaultOrder: 'nome' },
  reservas: { columns: ['id', 'cliente_id', 'pista_id', 'data_inicio', 'data_fim', 'qtd_pilotos', 'valor', 'status', 'notes', 'created_at'], search: ['notes'], defaultOrder: 'data_inicio', defaultDir: 'desc', dateColumn: 'data_inicio' },
  reservas_full: { columns: ['id', 'cliente_id', 'pista_id', 'data_inicio', 'data_fim', 'qtd_pilotos', 'valor', 'status', 'notes', 'created_at', 'cliente_nome', 'pista_nome'], search: ['cliente_nome', 'pista_nome', 'notes'], defaultOrder: 'data_inicio', defaultDir: 'desc', dateColumn: 'data_inicio', readOnly: true },
  recepcao_atendimentos: { columns: ['id', 'cliente_id', 'nome', 'tipo', 'reserva_id', 'status', 'notes', 'created_at', 'updated_at'], search: ['nome', 'tipo', 'notes'], defaultOrder: 'created_at' },
  recepcao_full: { columns: ['id', 'cliente_id', 'nome', 'tipo', 'reserva_id', 'status', 'notes', 'created_at', 'updated_at', 'cliente_nome', 'reserva_data_inicio', 'reserva_status'], search: ['nome', 'tipo', 'cliente_nome', 'notes'], defaultOrder: 'created_at', readOnly: true },
  lanchonete_produtos: { columns: ['id', 'nome', 'sku', 'categoria', 'preco', 'ativo'], booleans: ['ativo'], search: ['nome', 'sku', 'categoria'], defaultOrder: 'nome' },
  lanchonete_estoque: { columns: ['id', 'produto_id', 'quantidade', 'min_alerta'], defaultOrder: 'produto_id' },
  lanchonete_vendas: { columns: ['id', 'total', 'pagamento', 'created_at'], defaultOrder: 'created_at', defaultDir: 'desc' },
  financeiro_categorias: { columns: ['id', 'nome', 'tipo'], search: ['nome', 'tipo'], defaultOrder: 'tipo' },
  financeiro_lancamentos: { columns: ['id', 'descricao', 'valor', 'tipo', 'categoria_id', 'data', 'origem', 'origem_ref', 'status', 'created_at'], search: ['descricao', 'origem'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data' },
  financeiro_full: { columns: ['id', 'descricao', 'valor', 'tipo', 'categoria_id', 'data', 'origem', 'origem_ref', 'status', 'created_at', 'categoria_nome', 'categoria_tipo'], search: ['descricao', 'origem', 'categoria_nome'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data', readOnly: true },
  campeonatos: { columns: ['id', 'nome', 'slug', 'temporada', 'status'], search: ['nome', 'slug', 'temporada'], defaultOrder: 'nome' },
  etapas: { columns: ['id', 'campeonato_id', 'nome', 'data', 'round', 'status'], search: ['nome'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data' },
  etapas_full: { columns: ['id', 'campeonato_id', 'nome', 'data', 'round', 'status', 'campeonato_nome'], search: ['nome', 'campeonato_nome'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data', readOnly: true },
  pilotos: { columns: ['id', 'nome', 'numero', 'equipe', 'cliente_id'], search: ['nome', 'numero', 'equipe'], defaultOrder: 'nome' },
  classificacao: { columns: ['id', 'campeonato_id', 'piloto_id', 'pontos', 'posicao'], defaultOrder: 'posicao' },
  classificacao_full: { columns: ['id', 'campeonato_id', 'piloto_id', 'pontos', 'posicao', 'piloto_nome', 'piloto_numero', 'piloto_equipe'], search: ['piloto_nome', 'piloto_numero', 'piloto_equipe'], defaultOrder: 'posicao', readOnly: true },
  sessoes: { columns: ['id', 'campeonato_id', 'etapa_id', 'nome', 'tipo', 'data', 'status', 'fonte', 'created_at'], search: ['nome', 'tipo', 'fonte'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data' },
  sessoes_full: { columns: ['id', 'campeonato_id', 'etapa_id', 'nome', 'tipo', 'data', 'status', 'fonte', 'created_at', 'campeonato_nome'], search: ['nome', 'tipo', 'fonte', 'campeonato_nome'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data', readOnly: true },
  voltas: { columns: ['id', 'sessao_id', 'piloto_id', 'piloto_nome', 'kart', 'numero', 'tempo_ms', 'setor1_ms', 'setor2_ms', 'setor3_ms', 'posicao', 'melhor', 'valida', 'created_at'], booleans: ['melhor', 'valida'], search: ['piloto_nome', 'kart'], defaultOrder: 'posicao' },
  corridas: { columns: ['id', 'etapa_id', 'campeonato_id', 'titulo', 'data', 'status', 'source'], search: ['titulo', 'source'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data' },
  corridas_full: { columns: ['id', 'etapa_id', 'campeonato_id', 'titulo', 'data', 'status', 'source', 'campeonato_nome', 'etapa_nome'], search: ['titulo', 'source', 'campeonato_nome', 'etapa_nome'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data', readOnly: true },
  resultados: { columns: ['id', 'corrida_id', 'piloto_id', 'piloto_nome', 'posicao', 'melhor_volta', 'voltas', 'pontos', 'gap'], search: ['piloto_nome'], defaultOrder: 'posicao' },
  resultados_full: { columns: ['id', 'corrida_id', 'piloto_id', 'piloto_nome', 'posicao', 'melhor_volta', 'voltas', 'pontos', 'gap', 'piloto_numero', 'piloto_equipe'], search: ['piloto_nome', 'piloto_numero', 'piloto_equipe'], defaultOrder: 'posicao', readOnly: true },
  cronometragem_live: { columns: ['id', 'payload', 'updated_at'], defaultOrder: 'id', readOnly: true },
  // Karts management
  karts: { columns: ['id', 'numero', 'modelo', 'categoria', 'motor', 'status', 'km_total', 'ultima_manutencao', 'proxima_manutencao', 'notes', 'ativo', 'created_at'], booleans: ['ativo'], search: ['numero', 'modelo', 'categoria', 'motor'], defaultOrder: 'numero' },
  karts_manutencao: { columns: ['id', 'kart_id', 'tipo', 'descricao', 'custo', 'data', 'responsavel', 'status', 'created_at'], search: ['tipo', 'descricao', 'responsavel'], defaultOrder: 'data', defaultDir: 'desc', dateColumn: 'data' },
  karts_full: { columns: ['id', 'numero', 'modelo', 'categoria', 'motor', 'status', 'km_total', 'ultima_manutencao', 'proxima_manutencao', 'notes', 'ativo', 'created_at', 'manutencoes_pendentes'], search: ['numero', 'modelo', 'categoria'], defaultOrder: 'numero', readOnly: true },
  // Eventos
  eventos: { columns: ['id', 'titulo', 'descricao', 'tipo', 'cliente_id', 'pista_id', 'data_inicio', 'data_fim', 'qtd_participantes', 'valor', 'status', 'cor_tema', 'notes', 'created_at'], search: ['titulo', 'descricao', 'tipo'], defaultOrder: 'data_inicio', defaultDir: 'desc', dateColumn: 'data_inicio' },
  eventos_full: { columns: ['id', 'titulo', 'descricao', 'tipo', 'cliente_id', 'pista_id', 'data_inicio', 'data_fim', 'qtd_participantes', 'valor', 'status', 'cor_tema', 'notes', 'created_at', 'cliente_nome', 'pista_nome'], search: ['titulo', 'descricao', 'tipo', 'cliente_nome'], defaultOrder: 'data_inicio', defaultDir: 'desc', dateColumn: 'data_inicio', readOnly: true },
  // Clube de Vantagens
  clube_participantes: { columns: ['id', 'cliente_id', 'nome', 'email', 'pontos', 'nivel', 'ativo', 'created_at', 'updated_at'], booleans: ['ativo'], search: ['nome', 'email'], defaultOrder: 'pontos', defaultDir: 'desc' },
  clube_recompensas: { columns: ['id', 'nome', 'descricao', 'categoria', 'pontos_necessarios', 'estoque', 'ativo', 'imagem_url', 'created_at'], booleans: ['ativo'], search: ['nome', 'descricao', 'categoria'], defaultOrder: 'pontos_necessarios' },
  clube_resgates: { columns: ['id', 'participante_id', 'recompensa_id', 'pontos', 'status', 'notes', 'created_at', 'updated_at'], search: ['notes'], defaultOrder: 'created_at', defaultDir: 'desc' },
  clube_resgates_full: { columns: ['id', 'participante_id', 'recompensa_id', 'pontos', 'status', 'notes', 'created_at', 'updated_at', 'participante_nome', 'participante_pontos', 'recompensa_nome', 'pontos_necessarios'], search: ['participante_nome', 'recompensa_nome', 'notes'], defaultOrder: 'created_at', defaultDir: 'desc', readOnly: true },
  clube_campanhas: { columns: ['id', 'nome', 'descricao', 'tipo', 'multiplicador', 'ativo', 'data_inicio', 'data_fim', 'created_at'], booleans: ['ativo'], search: ['nome', 'descricao', 'tipo'], defaultOrder: 'nome' },
  clube_transacoes: { columns: ['id', 'participante_id', 'tipo', 'pontos', 'descricao', 'referencia', 'created_at'], search: ['descricao', 'referencia'], defaultOrder: 'created_at', defaultDir: 'desc' }
} as const satisfies Record<string, ResourceConfig>;

type ResourceName = keyof typeof resources;

const isResource = (value: string): value is ResourceName => value in resources;
const getConfig = (resource: ResourceName): ResourceConfig => resources[resource];
const json = (body: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(body, { status, headers });

function normalizeRow(resource: ResourceName, row: Row): Row {
  const config = getConfig(resource);
  const normalized = { ...row };
  for (const column of config.booleans ?? []) normalized[column] = Boolean(normalized[column]);
  for (const column of config.json ?? []) {
    if (typeof normalized[column] === 'string') {
      try { normalized[column] = JSON.parse(normalized[column] as string); } catch { /* retain legacy text */ }
    }
  }
  return normalized;
}

function normalizePayload(resource: ResourceName, input: unknown, partial = false): Row {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_payload');
  const config = getConfig(resource);
  const payload: Row = {};
  for (const [key, value] of Object.entries(input)) {
    if (!config.columns.includes(key)) throw new Error(`invalid_field:${key}`);
    if (key === 'id' && partial) continue;
    if (config.booleans?.includes(key)) payload[key] = value ? 1 : 0;
    else if (config.json?.includes(key)) payload[key] = JSON.stringify(value ?? null);
    else payload[key] = value;
  }
  return payload;
}

async function audit(db: AdminD1Database, actor: string, action: string, entity: string, entityId: string | null, details?: unknown) {
  await db.prepare('INSERT INTO audit_log (actor, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)')
    .bind(actor, action, entity, entityId, details === undefined ? null : JSON.stringify(details)).run();
}

async function ensureAdminProfile(db: AdminD1Database, actor: string) {
  await db.prepare(`INSERT OR IGNORE INTO profiles (id, email, full_name, role, active)
    VALUES ('admin-primary', ?, 'Administrador', 'owner', 1)`).bind(actor).run();
}

function resolveBridgeBase(): string | null {
  const endpoint = process.env.LIVETIME_SNAPSHOT_ENDPOINT;
  if (!endpoint) return null;
  return endpoint.replace(/\/api\/livetime-snapshot.*$/, '').replace(/\/+$/, '');
}

async function syncClientesFromBridge(db: AdminD1Database, actor: string) {
  const existing = await db.prepare('SELECT COUNT(*) AS total FROM clientes').first<{ total: number }>();
  if (Number(existing?.total ?? 0) > 0) return;

  const base = resolveBridgeBase();
  if (!base) return;

  try {
    const response = await fetch(`${base}/api/clientes?limit=2000`, {
      headers: { 'ngrok-skip-browser-warning': 'true', accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.length) return;

    const statements = body.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const cliente = value as Row;
      if (!cliente.id || !cliente.nome) return [];
      return [db.prepare(`INSERT INTO clientes (id, nome, email, telefone, cpf, cidade, estado, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
        nome=excluded.nome, email=excluded.email, telefone=excluded.telefone, cpf=excluded.cpf, cidade=excluded.cidade, estado=excluded.estado, created_at=excluded.created_at`)
        .bind(String(cliente.id), String(cliente.nome), cliente.email ?? null, cliente.telefone ?? null, cliente.documento ?? null, cliente.cidade ?? null, cliente.estado ?? null, cliente.criadoEm ?? null)];
    });
    for (let index = 0; index < statements.length; index += 100) {
      await db.batch(statements.slice(index, index + 100));
    }
    await audit(db, actor, 'sync', 'clientes', null, { count: statements.length });
  } catch {
    // The operational bridge may be temporarily offline; existing D1 data remains usable.
  }
}

async function list(db: AdminD1Database, resource: ResourceName, url: URL) {
  const config = getConfig(resource);
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  for (const [key, value] of url.searchParams) {
    if (key.startsWith('eq_')) {
      const column = key.slice(3);
      if (!config.columns.includes(column)) throw new Error(`invalid_filter:${column}`);
      clauses.push(`${column} = ?`);
      bindings.push(value);
    } else if (key.startsWith('in_')) {
      const column = key.slice(3);
      if (!config.columns.includes(column)) throw new Error(`invalid_filter:${column}`);
      const values = value.split(',').filter(Boolean);
      if (!values.length) continue;
      clauses.push(`${column} IN (${values.map(() => '?').join(',')})`);
      bindings.push(...values);
    }
  }

  for (const direct of ['campeonato_id', 'corrida_id', 'etapa_id', 'pista_id', 'categoria_id', 'status', 'tipo', 'evento']) {
    const value = url.searchParams.get(direct);
    if (value !== null && config.columns.includes(direct)) {
      clauses.push(`${direct} = ?`);
      bindings.push(value);
    }
  }

  const query = url.searchParams.get('q')?.trim();
  if (query && config.search?.length) {
    clauses.push(`(${config.search.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    bindings.push(...config.search.map(() => `%${query}%`));
  }

  if (config.dateColumn) {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from) { clauses.push(`${config.dateColumn} >= ?`); bindings.push(from); }
    if (to) { clauses.push(`${config.dateColumn} <= ?`); bindings.push(`${to}T23:59:59.999`); }
  }

  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const orderCandidate = url.searchParams.get('order') || config.defaultOrder;
  const order = orderCandidate && config.columns.includes(orderCandidate) ? orderCandidate : config.defaultOrder;
  const requestedDirection = url.searchParams.get('dir');
  const direction = requestedDirection
    ? (requestedDirection === 'desc' ? 'DESC' : 'ASC')
    : config.defaultDir === 'desc' ? 'DESC' : 'ASC';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 500), 1), 1000);
  const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);

  const countResult = await db.prepare(`SELECT COUNT(*) AS total FROM ${resource}${where}`).bind(...bindings).first<{ total: number }>();
  const result = await db.prepare(`SELECT * FROM ${resource}${where}${order ? ` ORDER BY ${order} ${direction}` : ''} LIMIT ? OFFSET ?`)
    .bind(...bindings, limit, offset).all<Row>();
  return { rows: result.results.map((row) => normalizeRow(resource, row)), total: Number(countResult?.total ?? 0) };
}

async function create(db: AdminD1Database, resource: ResourceName, body: unknown, actor: string) {
  const config = getConfig(resource);
  if (config.readOnly) throw new Error('read_only_resource');
  const payload = normalizePayload(resource, body);
  if (!('id' in payload)) payload.id = crypto.randomUUID();
  const keys = Object.keys(payload);
  if (!keys.length) throw new Error('invalid_payload');
  await db.prepare(`INSERT INTO ${resource} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).bind(...keys.map((key) => payload[key])).run();
  await audit(db, actor, 'create', resource, String(payload.id), payload);
  const row = await db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).bind(payload.id).first<Row>();
  return row ? normalizeRow(resource, row) : null;
}

async function update(db: AdminD1Database, resource: ResourceName, id: string, body: unknown, actor: string) {
  const config = getConfig(resource);
  if (config.readOnly) throw new Error('read_only_resource');
  const payload = normalizePayload(resource, body, true);
  const keys = Object.keys(payload);
  if (!keys.length) throw new Error('invalid_payload');
  const result = await db.prepare(`UPDATE ${resource} SET ${keys.map((key) => `${key} = ?`).join(',')} WHERE id = ?`)
    .bind(...keys.map((key) => payload[key]), id).run();
  if (!result.meta.changes) throw new Error('record_not_found');
  await audit(db, actor, 'update', resource, id, payload);
  const row = await db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).bind(id).first<Row>();
  return row ? normalizeRow(resource, row) : null;
}

async function remove(db: AdminD1Database, resource: ResourceName, id: string, actor: string) {
  if (getConfig(resource).readOnly) throw new Error('read_only_resource');
  const result = await db.prepare(`DELETE FROM ${resource} WHERE id = ?`).bind(id).run();
  if (!result.meta.changes) throw new Error('record_not_found');
  await audit(db, actor, 'delete', resource, id);
  return { ok: true };
}

async function upsertStock(db: AdminD1Database, body: unknown, actor: string) {
  const payload = normalizePayload('lanchonete_estoque', body);
  const produtoId = String(payload.produto_id || '');
  if (!produtoId) throw new Error('produto_id_required');
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO lanchonete_estoque (id, produto_id, quantidade, min_alerta) VALUES (?, ?, ?, ?)
    ON CONFLICT(produto_id) DO UPDATE SET quantidade = excluded.quantidade, min_alerta = excluded.min_alerta`)
    .bind(id, produtoId, payload.quantidade ?? 0, payload.min_alerta ?? 0).run();
  await audit(db, actor, 'upsert', 'lanchonete_estoque', produtoId, payload);
  const row = await db.prepare('SELECT * FROM lanchonete_estoque WHERE produto_id = ?').bind(produtoId).first<Row>();
  return row;
}

async function upsertClassificacao(db: AdminD1Database, body: unknown, actor: string) {
  if (!Array.isArray(body)) throw new Error('invalid_payload');
  const statements = body.map((item) => {
    const row = normalizePayload('classificacao', item);
    return db.prepare(`INSERT INTO classificacao (id, campeonato_id, piloto_id, pontos, posicao) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(campeonato_id, piloto_id) DO UPDATE SET pontos=excluded.pontos, posicao=excluded.posicao`)
      .bind(row.id || crypto.randomUUID(), row.campeonato_id ?? null, row.piloto_id ?? null, row.pontos ?? 0, row.posicao ?? null);
  });
  if (statements.length) await db.batch(statements);
  await audit(db, actor, 'upsert_many', 'classificacao', null, { count: statements.length });
  return body;
}

async function registerSale(db: AdminD1Database, body: unknown, actor: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_payload');
  const payment = String((body as Row).pagamento || '');
  const items = (body as Row).itens;
  if (!['dinheiro', 'cartao', 'pix', 'cortesia'].includes(payment) || !Array.isArray(items) || !items.length) throw new Error('invalid_sale');

  const normalized = items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('invalid_sale_item');
    const produtoId = String((item as Row).produto_id || '');
    const quantidade = Number((item as Row).quantidade);
    if (!produtoId || !Number.isInteger(quantidade) || quantidade <= 0) throw new Error('invalid_sale_item');
    return { produtoId, quantidade };
  });

  const products = await Promise.all(normalized.map(({ produtoId }) => db.prepare(`SELECT p.id, p.preco, p.ativo, e.quantidade
    FROM lanchonete_produtos p LEFT JOIN lanchonete_estoque e ON e.produto_id=p.id WHERE p.id=?`).bind(produtoId).first<Row>()));
  let total = 0;
  const saleId = crypto.randomUUID();
  const statements: AdminD1Statement[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const item = normalized[index];
    const product = products[index];
    if (!product || !product.ativo) throw new Error('produto_indisponivel');
    if (Number(product.quantidade ?? 0) < item.quantidade) throw new Error('estoque_insuficiente');
    const price = Number(product.preco);
    const subtotal = price * item.quantidade;
    total += subtotal;
    statements.push(db.prepare('UPDATE lanchonete_estoque SET quantidade = quantidade - ? WHERE produto_id = ?').bind(item.quantidade, item.produtoId));
    statements.push(db.prepare('INSERT INTO lanchonete_venda_itens (id, venda_id, produto_id, quantidade, preco_unit, subtotal) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), saleId, item.produtoId, item.quantidade, price, subtotal));
  }
  statements.unshift(db.prepare('INSERT INTO lanchonete_vendas (id, total, pagamento) VALUES (?, ?, ?)').bind(saleId, total, payment));
  await db.batch(statements);
  await audit(db, actor, 'create', 'lanchonete_vendas', saleId, { total, pagamento: payment, itens: normalized.length });
  return { venda_id: saleId, total };
}

export async function handleAdminD1(request: NextRequest, path: string[], db: AdminD1Database, actor: string) {
  try {
    const [resourceName, id] = path;
    if (resourceName === 'registrar_venda' && request.method === 'POST') return json(await registerSale(db, await request.json(), actor));
    if (resourceName === 'lanchonete_estoque' && id === 'upsert' && request.method === 'PUT') return json(await upsertStock(db, await request.json(), actor));
    if (resourceName === 'classificacao' && id === 'upsert' && request.method === 'PUT') return json(await upsertClassificacao(db, await request.json(), actor));
    if (!resourceName || !isResource(resourceName)) return json({ error: 'resource_not_found' }, 404);

    if (request.method === 'GET') {
      if (resourceName === 'profiles') await ensureAdminProfile(db, actor);
      if (resourceName === 'clientes') await syncClientesFromBridge(db, actor);
      const result = await list(db, resourceName, request.nextUrl);
      return json(result.rows, 200, { 'x-total-count': String(result.total) });
    }
    if (request.method === 'POST' && !id) return json(await create(db, resourceName, await request.json(), actor), 201);
    if (request.method === 'PATCH' && id) return json(await update(db, resourceName, id, await request.json(), actor));
    if (request.method === 'DELETE' && id) return json(await remove(db, resourceName, id, actor));
    return json({ error: 'method_not_allowed' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'database_error';
    const status = message === 'record_not_found' ? 404 : message.startsWith('invalid_') ? 400 : 422;
    return json({ error: message }, status);
  }
}
