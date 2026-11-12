/**
 * Funções do site que antes só existiam como remendo no bundle publicado (docs/operacao/patches-producao/painel-20261110):
 *  - painel do organizador do grupo (/painel + /api/grupo/painel, ações pela fila no R2);
 *  - aviso no topo da reserva online (/api/aviso, editado pelo admin via SRVKART);
 *  - termo de responsabilidade aceito no cadastro (/api/termo, texto publicado pelo SRVKART);
 *  - prévia de cupom na reserva online (/api/reservas/cupom, calculada pelo SRVKART).
 * O SRVKART (lib/ops/grupos.ts, termo-online.ts, reserva-online.ts) escreve e lê pelas rotas /api/sync/*.
 */

import { resultadosDoCliente } from './mobile/results';

type R2 = {
  get(key: string): Promise<{ json<T = unknown>(): Promise<T> } | null>;
  put(key: string, value: string, opts?: unknown): Promise<unknown>;
  delete(key: string | string[]): Promise<unknown>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated?: boolean; cursor?: string }>;
};
type EnvExtras = { PRE: R2 };

const json = (status: number, body: unknown, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });
const JSON_R2 = { httpMetadata: { contentType: 'application/json' } };
const lerJson = async <T>(env: EnvExtras, key: string): Promise<T | null> => { try { return (await (await env.PRE.get(key))?.json<T>()) ?? null; } catch { return null; } };

// ---------------------------------------------------------------- painel do organizador

type Vaga = { ordem: number; nome: string | null; responsavel: boolean; menor: boolean; cadastro: string; falta: string[]; pago: boolean; termo: boolean; link: string; podeLiberar?: boolean };
type Painel = { chave: string; n: number; termos?: number; total: number; pago: number; falta: number; pagos: number; cadastrados: number; prontos: number; vagas: Vaga[] };
type GrupoResumo = { codigo: string; status: string; responsavel: string; bateria: string; inicio: string; modo: string; precoCentavos: number; responsavelToken?: string | null; painel?: Painel | null };

let cache: { em: number; lista: GrupoResumo[] } | null = null;
export function esquecerGrupos() { cache = null; }
async function grupos(env: EnvExtras) {
  if (!cache || Date.now() - cache.em > 30_000) cache = { em: Date.now(), lista: (await lerJson<GrupoResumo[]>(env, 'grupos/todos.json')) ?? [] };
  return cache;
}
function mesmaChave(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function painelDoGrupo(env: EnvExtras, codigo: string, chave: string) {
  if (!/^G[0-9A-F]{4,11}$/.test(codigo) || !/^[A-Za-z0-9_-]{16}$/.test(chave)) return null;
  const c = await grupos(env);
  const g = c.lista.find((x) => x.codigo === codigo);
  if (!g?.painel || !mesmaChave(g.painel.chave, chave)) return null;
  const { chave: _c, ...painel } = g.painel;
  const pendentes: number[] = [];
  for (const o of (await env.PRE.list({ prefix: `grupos/acoes/${g.codigo}-` })).objects ?? []) {
    const n = Number(o.key.split('-').pop()!.replace('.json', ''));
    if (Number.isInteger(n)) pendentes.push(n);
  }
  const recusas: Record<number, string> = {};
  for (const o of (await env.PRE.list({ prefix: `grupos/acoes-erro/${g.codigo}-` })).objects ?? []) {
    const e = await lerJson<{ ordem: number; erro: string; em: string }>(env, o.key);
    if (e && Date.parse(e.em) > Date.now() - 3_600_000) recusas[e.ordem] = e.erro; else await env.PRE.delete(o.key);
  }
  return {
    codigo: g.codigo, responsavel: g.responsavel, bateria: g.bateria, inicio: g.inicio, modo: g.modo, precoCentavos: g.precoCentavos, status: g.status,
    linkGrupo: g.responsavelToken ? `https://cadastro.kartodromodebetim.com.br/?r=${g.responsavelToken}` : null,
    atualizadoEm: new Date(c.em).toISOString(), ...painel, pendentes, recusas,
  };
}

// ---------------------------------------------------------------- termo

export type Termo = { versao: string; titulo: string; empresa: string; paragrafos: { titulo?: string; texto: string }[] };
let cacheTermo: { em: number; t: Termo | null } | null = null;
async function termoPublicado(env: EnvExtras) {
  if (!cacheTermo || Date.now() - cacheTermo.em > 60_000) cacheTermo = { em: Date.now(), t: await lerJson<Termo>(env, 'config/termo.json') };
  return cacheTermo.t;
}
/** Aceite do termo que vem no cadastro. `erro` quando a pessoa aceitou uma versão que já mudou. */
export async function aceiteDoCadastro(env: EnvExtras, corpo: Record<string, unknown>, ip: string | null): Promise<{ termo: Record<string, unknown> | null; erro?: string }> {
  const t = corpo.termo as { aceito?: unknown; versao?: unknown; imagem?: unknown } | undefined;
  if (!t || t.aceito !== true) return { termo: null };
  const atual = await termoPublicado(env);
  if (!atual) return { termo: null };
  if (String(t.versao) !== atual.versao) return { termo: null, erro: 'O termo foi atualizado agora há pouco. Recarregue a página e aceite de novo.' };
  return { termo: { versao: atual.versao, aceitoEm: new Date().toISOString(), imagem: t.imagem !== false, ip } };
}

// ---------------------------------------------------------------- cupom

export const cupomDoPedido = (v: unknown) => { const c = String(v ?? '').trim().toUpperCase(); return /^[A-Z0-9_-]{1,40}$/.test(c) ? c : null; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

// ---------------------------------------------------------------- rotas públicas

export async function rotasPublicas(req: Request, env: EnvExtras, p: string, url: URL, limite: (ip: string, tipo: string) => Promise<boolean>): Promise<Response | null> {
  if (p === '/api/grupo/painel' && req.method === 'GET') {
    const d = await painelDoGrupo(env, String(url.searchParams.get('g') ?? '').slice(0, 12), String(url.searchParams.get('k') ?? '').slice(0, 16));
    return json(d ? 200 : 404, d ?? { erro: 'Painel não encontrado. Confira o link ou fale com a recepção.' });
  }
  if (p === '/api/grupo/painel/acao' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const d = await painelDoGrupo(env, String(b.g ?? '').slice(0, 12), String(b.k ?? '').slice(0, 16));
    if (!d) return json(404, { erro: 'Painel não encontrado.' });
    if (b.acao !== 'liberar') return json(400, { erro: 'Ação inválida.' });
    const vaga = d.vagas.find((v) => v.ordem === Number(b.ordem));
    if (!vaga?.podeLiberar) return json(409, { erro: 'Esta vaga não pode ser liberada pelo painel. Fale com a recepção.' });
    if (Date.parse(String(d.inicio).slice(0, 16) + ':00-03:00') < Date.now() + 3_600_000) return json(409, { erro: 'Falta menos de 1 hora para a bateria. Fale com a recepção.' });
    await env.PRE.put(`grupos/acoes/${d.codigo}-${vaga.ordem}.json`, JSON.stringify({ codigo: d.codigo, acao: 'liberar', ordem: vaga.ordem, em: new Date().toISOString() }), JSON_R2);
    await env.PRE.delete(`grupos/acoes-erro/${d.codigo}-${vaga.ordem}.json`);
    return json(202, { ok: true });
  }
  if (p === '/api/reservas/minhas' && req.method === 'POST') {
    if (await limite(req.headers.get('cf-connecting-ip') ?? 'x', 'minhas')) return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cpf = digitos(b.cpf), codigo = String(b.codigo ?? '').trim().toUpperCase();
    if (cpf.length !== 11 || !/^[A-Z0-9]{6}$/.test(codigo)) return json(400, { erro: 'Informe o CPF de quem reservou e o código da reserva (6 letras e números).' });
    const r = await minhasReservas(env, cpf, codigo);
    return json(r ? 200 : 404, r ?? { erro: 'Não achamos reserva com esse CPF e código. Confira os dados ou fale com a recepção.' });
  }
  if (p === '/api/reservas/corridas' && req.method === 'POST') {
    if (await limite(req.headers.get('cf-connecting-ip') ?? 'x', 'minhas')) return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cpf = digitos(b.cpf), codigo = String(b.codigo ?? '').trim().toUpperCase();
    if (cpf.length !== 11 || !/^[A-Z0-9]{6}$/.test(codigo)) return json(400, { erro: 'Informe o CPF e o código da reserva.' });
    if (!(await minhasReservas(env, cpf, codigo))) return json(404, { erro: 'Não achamos reserva com esse CPF e código.' });
    const ops = ((env as { OPS_URL?: string }).OPS_URL || 'https://ops.kartodromodebetim.com.br').replace(/\/+$/, '');
    let clienteId: string | null = null;
    try {
      const r = await fetch(`${ops}/api/totem/identificar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identificador: cpf }), signal: AbortSignal.timeout(4000) });
      const d = r.ok ? ((await r.json()) as { cliente?: { id?: unknown } }) : null;
      if (d?.cliente?.id) clienteId = String(d.cliente.id);
    } catch { /* servidor do kartódromo fora: sem histórico agora */ }
    if (!clienteId) return json(200, { corridas: [], aviso: 'Não foi possível consultar o histórico agora. Tente de novo em instantes.' });
    return json(200, { corridas: await resultadosDoCliente(env as never, clienteId) });
  }
  if (p === '/api/aviso' && req.method === 'GET') {
    const a = await lerJson<{ texto?: string; tom?: string; ate?: string | null }>(env, 'config/aviso.json');
    const vale = a?.texto && (!a.ate || Date.parse(a.ate) > Date.now());
    return json(vale ? 200 : 404, vale ? { texto: a!.texto, tom: a!.tom === 'alerta' ? 'alerta' : 'info' } : null, 'public, max-age=30');
  }
  if (p === '/api/termo' && req.method === 'GET') {
    const t = await termoPublicado(env);
    return json(t ? 200 : 404, t, 'public, max-age=60');
  }
  if (p === '/api/reservas/cupom' && req.method === 'POST') {
    if (await limite(req.headers.get('cf-connecting-ip') ?? 'x', 'cupom')) return json(429, { erro: 'Muitas tentativas de cupom. Aguarde alguns minutos.' });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const codigo = cupomDoPedido(b.codigo);
    const bateriaId = Number(b.bateriaId), quantidade = Number(b.quantidade);
    const documento = digitos(b.documento);
    const documentos = (Array.isArray(b.documentos) ? b.documentos : []).slice(0, 10).map(digitos).filter((d) => d.length === 11);
    if (!codigo || !Number.isSafeInteger(bateriaId) || bateriaId < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10) return json(400, { erro: 'Confira o código do cupom.' });
    if (documento.length !== 11) return json(400, { erro: 'Informe o CPF de quem reserva antes de aplicar o cupom.' });
    const id = crypto.randomUUID();
    await env.PRE.put(`cupons/site/${id}.json`, JSON.stringify({ codigo, bateriaId, quantidade, documento, documentos, state: 'pending', em: Date.now() }), JSON_R2);
    return json(202, { requestId: id });
  }
  if (p.startsWith('/api/reservas/cupom/') && req.method === 'GET') {
    const id = p.slice('/api/reservas/cupom/'.length);
    if (!UUID.test(id)) return json(404, { erro: 'Prévia não encontrada.' });
    const r = await lerJson<{ state: string; em: number; resultado?: Record<string, unknown> }>(env, `cupons/site/${id}.json`);
    if (!r || Date.now() - r.em > 600_000) return json(404, { erro: 'Prévia expirada. Aplique o cupom de novo.' });
    return json(200, r.state === 'pending' ? { status: 'pending' } : { status: 'completed', ...r.resultado });
  }
  return null;
}

// ---------------------------------------------------------------- busca do cadastro pelo CPF/e-mail (preenche a página)

type Pendente = Record<string, unknown> & { menores?: unknown };
/** 30 buscas em 10 min por IP: cabe um grupo inteiro no Wi-Fi do kartódromo, mas não uma varredura de CPFs. */
async function muitasBuscas(ip: string) {
  const c = (caches as unknown as { default: Cache }).default;
  const k = new Request(`https://limite.cadastro/identificar/${encodeURIComponent(ip)}`);
  const n = Number(await (await c.match(k))?.text() ?? 0);
  if (n >= 30) return true;
  await c.put(k, new Response(String(n + 1), { headers: { 'cache-control': 'max-age=600' } }));
  return false;
}
/** Igual ao que funcionava no bundle antigo: primeiro o cadastro do SRVKART (totem), depois o pré-cadastro ainda não importado. */
export async function identificarCliente(req: Request, env: EnvExtras & { OPS_URL?: string }, buscarPendente: (q: string) => Promise<Pendente | null>, limite: (ip: string, tipo: string) => Promise<boolean>) {
  const url = new URL(req.url);
  let raw = '';
  if (req.method === 'POST') {
    const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    raw = String(corpo.identificador ?? corpo.documento ?? corpo.cpf ?? corpo.q ?? '').trim();
  } else {
    raw = String(url.searchParams.get('q') ?? url.searchParams.get('identificador') ?? url.searchParams.get('cpf') ?? url.searchParams.get('documento') ?? '').trim();
  }
  if (raw.length < 5) return json(200, { ok: true, cliente: null });
  // limite por aparelho: uso normal são 1 ou 2 buscas; evita varrer CPFs em massa
  if (await muitasBuscas(req.headers.get('cf-connecting-ip') ?? 'x')) return json(200, { ok: true, cliente: null });
  const ops = (env.OPS_URL || 'https://ops.kartodromodebetim.com.br').replace(/\/+$/, '');
  try {
    const r = await fetch(`${ops}/api/totem/identificar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identificador: raw }), signal: AbortSignal.timeout(3500) });
    if (r.ok) {
      const d = (await r.json()) as { cliente?: unknown; dependentes?: unknown[] };
      if (d?.cliente) return json(200, { ok: true, origem: 'servidor', cliente: d.cliente, dependentes: d.dependentes ?? [] });
    }
  } catch (e) { console.warn('identificarCliente ops-server:', (e as Error).message); }
  try {
    const p = await buscarPendente(raw);
    if (p) {
      const t = (v: unknown) => (v == null ? '' : String(v).trim());
      return json(200, {
        ok: true, origem: 'pendente',
        cliente: { nome: t(p.nome), tipoDocumento: t(p.tipoDocumento) || 'CPF', documento: t(p.documento), email: t(p.email), instagram: t(p.instagram), telefone: t(p.telefone),
          nascimento: t(p.nascimento), peso: t(p.peso), cep: t(p.cep), rua: t(p.endereco), endereco: t(p.endereco), numero: t(p.numero), complemento: t(p.complemento),
          bairro: t(p.bairro), cidade: t(p.cidade), estado: t(p.estado) },
        dependentes: Array.isArray(p.menores) ? p.menores : [],
      });
    }
  } catch (e) { console.warn('identificarCliente pendentes:', (e as Error).message); }
  return json(200, { ok: true, cliente: null });
}

// ---------------------------------------------------------------- minhas reservas (CPF + código de uma reserva)

type PedidoGuardado = { id: string; codigo: string; status: string; criadoEm: string; quantidade: number; forma: string; cliente?: { documento?: string; nome?: string };
  servidor?: { inicio?: string; valorCentavos?: number; descricao?: string }; pagamento?: { valorCentavos?: number } };

/** Índices para achar os pedidos de um CPF (chamado sempre que um pedido é gravado). */
export async function indexarPedido(env: EnvExtras, p: PedidoGuardado) {
  const cpf = digitos(p.cliente?.documento);
  if (cpf.length === 11) await env.PRE.put(`reservas/por-cpf/${cpf}/${p.id}`, '1');
  if (p.codigo) await env.PRE.put(`reservas/por-codigo/${p.codigo}`, p.id);
}

async function minhasReservas(env: EnvExtras, cpf: string, codigo: string) {
  const id = await (await env.PRE.get(`reservas/por-codigo/${codigo}`) as unknown as { text(): Promise<string> } | null)?.text();
  if (!id) return null;
  const dono = await lerJson<PedidoGuardado>(env, `reservas/pedidos/${id}.json`);
  if (!dono || digitos(dono.cliente?.documento) !== cpf) return null;
  const ids = ((await env.PRE.list({ prefix: `reservas/por-cpf/${cpf}/` })).objects ?? []).map((o) => o.key.split('/').pop()!).slice(-30);
  const lista = [];
  for (const i of ids) {
    const p = await lerJson<PedidoGuardado>(env, `reservas/pedidos/${i}.json`);
    if (!p) continue;
    lista.push({ id: p.id, codigo: p.codigo, status: p.status, criadoEm: p.criadoEm, quantidade: p.quantidade, forma: p.forma,
      inicio: p.servidor?.inicio ?? null, descricao: p.servidor?.descricao ?? null, valorCentavos: p.pagamento?.valorCentavos || p.servidor?.valorCentavos || null });
  }
  lista.sort((a, b) => String(b.inicio ?? b.criadoEm).localeCompare(String(a.inicio ?? a.criadoEm)));
  return { nome: String(dono.cliente?.nome ?? '').split(' ')[0], reservas: lista };
}

// ---------------------------------------------------------------- rotas do SRVKART (/api/sync, já autenticadas)

export async function rotasSync(req: Request, env: EnvExtras, p: string): Promise<Response | null> {
  if (p === '/api/sync/aviso' && req.method === 'PUT') {
    const a = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const texto = String(a.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (!texto) { await env.PRE.delete('config/aviso.json'); return json(200, { ok: true, aviso: null }); }
    const aviso = { texto, tom: a.tom === 'alerta' ? 'alerta' : 'info', ate: /^\d{4}-\d{2}-\d{2}T/.test(String(a.ate ?? '')) ? String(a.ate) : null, em: new Date().toISOString() };
    await env.PRE.put('config/aviso.json', JSON.stringify(aviso), JSON_R2);
    return json(200, { ok: true, aviso });
  }
  if (p === '/api/sync/termo' && req.method === 'PUT') {
    const t = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const paragrafos = (Array.isArray(t.paragrafos) ? t.paragrafos : []).slice(0, 40)
      .map((x: { titulo?: unknown; texto?: unknown }) => ({ ...(x?.titulo ? { titulo: String(x.titulo).slice(0, 120) } : {}), texto: String(x?.texto ?? '').slice(0, 3000) }))
      .filter((x) => x.texto);
    if (!/^[a-f0-9]{12}$/.test(String(t.versao ?? '')) || !paragrafos.length) return json(400, { erro: 'Termo inválido.' });
    const termo: Termo = { versao: String(t.versao), titulo: String(t.titulo ?? 'Termo de Responsabilidade').slice(0, 80), empresa: String(t.empresa ?? '').slice(0, 160), paragrafos };
    await env.PRE.put('config/termo.json', JSON.stringify(termo), JSON_R2);
    cacheTermo = null;
    return json(200, { ok: true, versao: termo.versao });
  }
  if (p === '/api/sync/grupos/acoes' && req.method === 'GET') {
    const acoes = [];
    for (const o of ((await env.PRE.list({ prefix: 'grupos/acoes/' })).objects ?? []).slice(0, 50)) {
      const a = await lerJson<Record<string, unknown>>(env, o.key);
      if (a) acoes.push({ key: o.key, ...a });
    }
    return json(200, { acoes });
  }
  if (p === '/api/sync/grupos/acoes' && req.method === 'POST') {
    const { feitas } = (await req.json().catch(() => ({}))) as { feitas?: { key?: unknown; erro?: unknown }[] };
    for (const f of Array.isArray(feitas) ? feitas.slice(0, 50) : []) {
      const key = String(f.key ?? '');
      if (!/^grupos\/acoes\/G[0-9A-F]{4,11}-\d{1,3}\.json$/.test(key)) continue;
      await env.PRE.delete(key);
      if (f.erro) {
        const [cod, ordem] = key.slice('grupos/acoes/'.length, -5).split('-');
        await env.PRE.put(`grupos/acoes-erro/${cod}-${ordem}.json`, JSON.stringify({ ordem: Number(ordem), erro: String(f.erro).slice(0, 200), em: new Date().toISOString() }), JSON_R2);
      }
    }
    cache = null;
    return json(200, { ok: true });
  }
  // índice dos pedidos antigos (rodar uma vez): POST /api/sync/reservas/indexar { cursor? }
  if (p === '/api/sync/reservas/indexar' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { cursor?: string };
    const lista = await env.PRE.list({ prefix: 'reservas/pedidos/', cursor: b.cursor });
    let n = 0;
    for (const o of lista.objects ?? []) { const ped = await lerJson<PedidoGuardado>(env, o.key); if (ped) { await indexarPedido(env, ped); n++; } }
    return json(200, { indexados: n, cursor: lista.truncated ? lista.cursor : null });
  }
  if (p === '/api/sync/cupons-site' && req.method === 'GET') {
    const jobs = [];
    for (const o of ((await env.PRE.list({ prefix: 'cupons/site/' })).objects ?? []).slice(0, 50)) {
      const r = await lerJson<Record<string, unknown> & { em: number; state: string }>(env, o.key);
      if (!r || Date.now() - r.em > 600_000) { await env.PRE.delete(o.key); continue; }
      if (r.state === 'pending') jobs.push({ requestId: o.key.slice('cupons/site/'.length, -5), codigo: r.codigo, bateriaId: r.bateriaId, quantidade: r.quantidade, documento: r.documento, documentos: r.documentos });
    }
    return json(200, jobs);
  }
  if (p.startsWith('/api/sync/cupons-site/') && req.method === 'POST') {
    const id = p.slice('/api/sync/cupons-site/'.length);
    if (!UUID.test(id)) return json(404, { erro: 'Prévia não encontrada.' });
    const k = `cupons/site/${id}.json`;
    const r = await lerJson<Record<string, unknown>>(env, k);
    if (!r) return json(404, { erro: 'Prévia não encontrada.' });
    const v = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ok = ['brutoCentavos', 'descontoCentavos', 'totalCentavos'].every((c) => Number.isSafeInteger(Number(v[c])) && Number(v[c]) >= 0);
    const resultado = typeof v.erro === 'string' && v.erro ? { erro: v.erro.slice(0, 300) }
      : ok ? { brutoCentavos: Number(v.brutoCentavos), descontoCentavos: Number(v.descontoCentavos), totalCentavos: Number(v.totalCentavos) }
      : { erro: 'Não foi possível conferir o cupom agora.' };
    await env.PRE.put(k, JSON.stringify({ ...r, state: 'completed', resultado }), JSON_R2);
    return json(200, { ok: true });
  }
  return null;
}
