/* eslint-disable @typescript-eslint/no-explicit-any -- respostas dinâmicas da API do app (conta/convite) */
/**
 * Página Pilotos do painel web: a cartela de clientes (kart.cliente) com a carreira de cada um na cronometragem,
 * o ranking dos melhores tempos por traçado (semana, mês e geral) e a foto do piloto (kart.cliente_foto).
 *
 * A carreira vem das baterias encerradas do ORBITS (GET /api/sessions e /api/sessions/:id): cada bateria encerrada é
 * lida uma vez e guardada em .runtime/pilotos-cronometragem.json (bateria encerrada não muda; se a cronometragem
 * reabrir uma, o finishedAt muda e ela é lida de novo). Só entra no ranking volta de bateria sem chuva, fora da
 * equalização, de piloto com nome (não "Kart 12") e não desclassificado.
 */
import { existsSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CLIENTE_COLS, one, onlyDigits, query } from './db';
import { HttpError } from './office';
import { mobileApiEndpoint } from '../mobile-api-url';
import { publicarHistoricoDoCliente } from './app-mobile';
import type { Sessao } from './auth';

type Req = { method: string; url: URL; body: () => Promise<Record<string, unknown>>; sessao: Sessao };
type Res = (status: number, body: unknown) => void;

const TIMING_URL = (process.env.OPS_TIMING_URL || 'http://192.168.20.249:4050').replace(/\/$/, '');
const ARQ = resolve(join(process.cwd(), '.runtime', 'pilotos-cronometragem.json'));

// ---------------------------------------------------------------- índice das baterias encerradas
/** `t` = traçado + categoria do piloto ("Traçado 1 · Super Kart"): Super Kart e Indoor correm juntos mas não se comparam. */
type Corrida = { cid: string | null; nome: string; kart: string; pos: number; voltas: number; melhor: number | null; cat: string | null; dq: boolean; t?: string };
/** `reserva` = bateria do LapTime de que só sobrou a reserva paga (quem andou), sem tempos nem posição. */
type BateriaCrono = { id: string; nome: string; tipo: string; dia: string; inicio: number; fim: number | null; chuva: boolean; trackId: string | null; tracado: string; pilotos: Corrida[]; reserva?: boolean };
let indice: Record<string, BateriaCrono> = {};
try { if (existsSync(ARQ)) indice = JSON.parse(readFileSync(ARQ, 'utf8')).baterias ?? {}; } catch { indice = {}; }
let atualizadoEm = 0, atualizando: Promise<void> | null = null, ultimoErro: string | null = null;
// versão do índice: sobe a cada gravação — o ranking do app só reconstrói quando muda (antes era reconstruído
// inteiro a cada 10 min e travava o servidor ~21 s; medido pelo watchdog em 28-29/10/2026)
let indiceVersao = 0;
/** Versão do índice de baterias: muda a cada bateria nova lida da cronometragem (o app publica na hora). */
export const versaoIndicePilotos = () => indiceVersao;

/** Chave estável do traçado nos documentos de posição do app (o Worker usa a mesma regra). */
export function slugTracado(nome: string) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'sem-nome';
}

/** Grava o índice em blocos com yield: stringify único de 27 MB travava o event loop por segundos. Mesma saída. */
async function gravarIndiceArq() {
  const pares: string[] = [];
  let n = 0;
  for (const [k, b] of Object.entries(indice)) {
    pares.push(JSON.stringify(k) + ':' + JSON.stringify(b));
    if ((++n & 255) === 255) await new Promise<void>((r) => setImmediate(r));
  }
  const tmp = ARQ + '.tmp';
  // 56 MB: gravação assíncrona (writeFileSync travava o servidor; 13/11/2026)
  await writeFile(tmp, '{"baterias":{' + pares.join(',') + '}}');
  await rename(tmp, ARQ);
  indiceVersao++;
}

/** O índice de baterias já carregado na memória (o mesmo conteúdo do arquivo de 56 MB, sem ler o disco). */
export function bateriasDoIndice(): Readonly<Record<string, BateriaCrono>> { return indice; }

const diaSp = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const hojeSp = () => diaSp(Date.now());
const somaDias = (dia: string, n: number) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const semNome = (nome: string, kart: string) => !nome.trim() || nome.trim().toLowerCase() === `kart ${kart}`.toLowerCase();
const chuvaNoNome = (t: string) => /chuva/i.test(t);
/** "Traçado 1 Normal" (cronometragem nova) e "Traçado 1" (LapTime) são o mesmo; "Invertido" continua separado. */
const tracadoBase = (t: string) => t.replace(/\s*\(chuva\)\s*/i, '').replace(/\s+normal$/i, '').trim();
/** Super Kart do LapTime faz tempos bem menores que o Indoor no mesmo traçado: ranking separado. */
const comCategoria = (t: string, cat: string | null | undefined) => (/super\s*kart/i.test(cat ?? '') && !/super kart/i.test(t) ? `${t} · Super Kart` : t);
const SEM_TRACADO = 'Traçado principal'; // bateria sem traçado marcado: conta na carreira, fica fora do ranking
let normalizado = false, limites: Map<string, number> | null = null;
/**
 * Cadastro duplicado da mesma pessoa (mesmo nome e mesmo e-mail, ex.: CPF digitado errado num deles) vira um piloto só:
 * as corridas de todos vão para o cadastro atualizado mais recentemente, que é o que a recepção e o app usam.
 */
let aliasCliente = new Map<string, string>();
/** nomes dos cadastros unificados (a busca do app acha o piloto também pelo nome antigo/apelido) */
let outrosNomesDe = new Map<string, string[]>();
let nomeCadastroDe = new Map<string, string>();
let aliasEm = 0;
async function carregarAliases(log?: (m: string) => void): Promise<boolean> {
  if (Date.now() - aliasEm < 10 * 60_000) return false;
  aliasEm = Date.now();
  try {
    const rows = await query<{ id: number; canon: number; nome: string; nomeCanon: string }>(
      `with g as (
         select id, lower(trim(email)) em, upper(trim(nome)) nm,
                row_number() over (partition by lower(trim(email)), upper(trim(nome)) order by atualizado_em desc, id desc) ordem,
                count(*) over (partition by lower(trim(email)), upper(trim(nome))) qtd
           from kart.cliente where responsavel_id is null and email like '_%@_%._%' and length(trim(nome)) >= 5)
       select a.id, b.id canon, (select nome from kart.cliente where id = a.id) nome, (select nome from kart.cliente where id = b.id) "nomeCanon" from g a join g b on b.em = a.em and b.nm = a.nm and b.ordem = 1 where a.qtd between 2 and 3 and a.ordem > 1`, {});
    const novo = new Map(rows.map((r) => [String(r.id), String(r.canon)]));
    const mudou = novo.size !== aliasCliente.size || [...novo].some(([k, v]) => aliasCliente.get(k) !== v);
    aliasCliente = novo;
    outrosNomesDe = new Map(); nomeCadastroDe = new Map(rows.filter((r) => r.nomeCanon?.trim()).map((r) => [String(r.canon), r.nomeCanon.trim()]));
    for (const r of rows) { const l = outrosNomesDe.get(String(r.canon)) ?? []; if (r.nome?.trim()) l.push(r.nome.trim()); outrosNomesDe.set(String(r.canon), l); }
    if (mudou) { normalizado = false; log?.(`pilotos: ${novo.size} cadastro(s) duplicado(s) unificado(s)`); }
    return mudou;
  } catch (e) { log?.(`pilotos: duplicados não lidos (${(e as Error).message})`); return false; }
}
function normalizarNomes() {
  const canon = (cid: string | null) => (cid && aliasCliente.get(cid)) || cid;
  for (const b of Object.values(indice)) { b.tracado = tracadoBase(b.tracado); for (const p of b.pilotos) { p.cid = canon(p.cid); p.t = comCategoria(b.tracado, catDoKart(p.kart) ?? p.cat); } }
  for (const x of rankAntigo) { x.cid = canon(x.cid); x.tracado = comCategoria(tracadoBase(x.tracado), x.categoria); }
  normalizado = true; limites = null;
}
/** Volta abaixo de 75% da volta típica (mediana) do traçado é corte de pista ou passagem dupla (o LapTime antigo tem várias). */
function limiteDe(tracado: string) {
  if (!limites) {
    const por = new Map<string, number[]>();
    const add = (t: string, ms: number) => { const l = por.get(t) ?? []; l.push(ms); por.set(t, l); };
    for (const b of Object.values(indice)) if (!b.chuva) for (const p of b.pilotos) if (p.melhor && !p.dq) add(tk(b, p), p.melhor);
    for (const x of rankAntigo) add(x.tracado, x.ms);
    limites = new Map([...por.entries()].map(([t, l]) => { l.sort((a, b) => a - b); return [t, l[Math.floor(l.length / 2)] * 0.75]; }));
  }
  return limites.get(tracado) ?? 0;
}
/** Volta mínima possível no Traçado 1: Indoor 1:10.000, Super Kart 1:04.000. Abaixo disso é outro traçado ou corte de pista. */
const pisoTracado = (tracado: string) => /^tra[cç]ado\s+1(?:\s*·\s*super kart)?$/i.test(tracado.trim()) ? (/super kart/i.test(tracado) ? 64_000 : 70_000) : 0;
const valeNoRanking = (tracado: string, ms: number | null) => !!ms && !tracado.startsWith(SEM_TRACADO) && ms >= limiteDe(tracado) && ms >= pisoTracado(tracado);
/** Kart 1-99 é Indoor, 100-199 é Super Kart: vale mais que a categoria do cadastro do piloto. */
const catDoKart = (kart: string | null | undefined) => { const s = String(kart ?? '').trim(); if (!/^\d{1,3}$/.test(s)) return null; const n = Number(s); return n >= 1 && n <= 99 ? 'Indoor' : n <= 199 && n >= 100 ? 'Super Kart' : null; };
const tk = (b: BateriaCrono, p: Corrida) => p.t ?? comCategoria(b.tracado, catDoKart(p.kart) ?? p.cat);
/** "cat-super kart" → "Super Kart"; categorias de campeonato ficam como vieram. */
const nomeCategoria = (c: string | null | undefined) => { const s = String(c ?? '').replace(/^cat-/i, '').trim(); return /super\s*kart/i.test(s) ? 'Super Kart' : /indoor/i.test(s) ? 'Indoor' : s ? s.charAt(0).toUpperCase() + s.slice(1) : null; };
const chaveNome = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function timing<T = Record<string, unknown>>(caminho: string): Promise<T> {
  const r = await fetch(TIMING_URL + caminho, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`cronometragem HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Lê as baterias encerradas que ainda não estão no índice (de 3 em 3, para não pesar no ORBITS). */
export function atualizarIndice(log?: (m: string) => void): Promise<void> {
  if (atualizando) return atualizando;
  atualizando = (async () => {
    // CalXPro (2023 a jan/2025) não depende da cronometragem estar no ar: lê uma vez e grava no índice
    // o histórico antigo também não depende da cronometragem (já está no índice gravado)
    try {
      if (!legadoCarregado) { await carregarLegado(log); await gravarIndiceArq(); }
      if (!calxproCarregado && await carregarCalxpro(log)) { await gravarIndiceArq(); }
    } catch (e) { log?.(`pilotos: índice dos sistemas antigos não foi gravado (${(e as Error).message})`); }
    try {
      const lista = (await timing('/api/sessions')) as { id: string; type: string; state: string; finishedAt: number | null; createdAt: number }[];
      const faltam = lista.filter((s) => s.state === 'encerrada' && s.type !== 'equalizacao' && (!indice[s.id] || indice[s.id].fim !== (s.finishedAt ?? null)));
      const vivos = new Set(lista.filter((s) => s.state === 'encerrada' && s.type !== 'equalizacao').map((s) => s.id));
      let mudou = false;
      for (const id of Object.keys(indice)) if (!id.startsWith('lt-') && !id.startsWith('lr-') && !id.startsWith('cx-') && !vivos.has(id)) { delete indice[id]; mudou = true; } // bateria cancelada ou apagada na cronometragem
      for (let i = 0; i < faltam.length; i += 3) {
        await Promise.all(faltam.slice(i, i + 3).map(async (s) => {
          try {
            const d = await timing<{
              name?: string;
              type?: string;
              createdAt: number;
              startedAt?: number;
              finishedAt?: number | null;
              chuva?: boolean;
              track?: { id?: string | null; name?: string };
              competitors?: { kart: string; name: string; customerId: string | null; category: string | null; autoAdded: boolean }[];
              standings?: { position: number; kart: string; name: string; laps: number; bestLapMs: number | null; desclassificado?: boolean }[];
            }>(`/api/sessions/${encodeURIComponent(s.id)}`);
            const comps = (d.competitors ?? []) as { kart: string; name: string; customerId: string | null; category: string | null; autoAdded: boolean }[];
            const pilotos: Corrida[] = [];
            for (const r of (d.standings ?? []) as { position: number; kart: string; name: string; laps: number; bestLapMs: number | null; desclassificado?: boolean }[]) {
              const c = comps.find((x) => x.kart === r.kart && x.name === r.name);
              if (!c || c.autoAdded || semNome(r.name, r.kart)) continue;
              pilotos.push({ cid: c.customerId ? String(c.customerId) : null, nome: r.name.trim(), kart: r.kart, pos: r.position, voltas: r.laps || 0, melhor: r.bestLapMs && r.bestLapMs > 0 ? r.bestLapMs : null, cat: c.category ?? null, dq: !!r.desclassificado });
            }
            const inicio = d.startedAt ?? d.createdAt;
            const tracado = String(d.track?.name ?? 'Traçado principal');
            indice[s.id] = { id: s.id, nome: String(d.name ?? '').split(' · ')[0] || d.name || '', tipo: d.type || '', dia: diaSp(inicio), inicio, fim: d.finishedAt ?? null, chuva: d.chuva === true || chuvaNoNome(tracado), trackId: d.track?.id ?? null, tracado: tracadoBase(tracado), pilotos };
            mudou = true;
          } catch (e) { log?.(`pilotos: bateria ${s.id} não foi lida (${(e as Error).message})`); }
        }));
      }
      if (await carregarAliases(log)) mudou = true;
      normalizarNomes();
      if (mudou) { await gravarIndiceArq(); }
      atualizadoEm = Date.now(); ultimoErro = null;
      if (faltam.length) log?.(`pilotos: ${faltam.length} bateria(s) lida(s) da cronometragem, ${Object.keys(indice).length} no índice`);
    } catch (e) { ultimoErro = (e as Error).message; log?.(`pilotos: cronometragem indisponível (${ultimoErro})`); }
    finally { atualizando = null; }
  })();
  return atualizando;
}
async function indiceFresco() { if (Date.now() - atualizadoEm > 120_000) await atualizarIndice(); if (!normalizado) normalizarNomes(); }

// ---------------------------------------------------------------- histórico dos sistemas antigos (2018 a set/2026, já gravado em .runtime)
// Corridas detalhadas só de 02/09 a 23/09/2026 (o LapTime não guardava mais que isso); rankings diário/semanal/mensal desde
// jan/2025 com os 10 primeiros de cada faixa de peso, por traçado e categoria (Indoor, Super Kart). O LapTime foi desligado em
// 23/09: os dados não mudam mais, então são lidos uma vez e guardados em .runtime/pilotos-laptime.json.
type RankAntigo = { tipo: 'semana' | 'mes'; periodo: string; dia: string; tracado: string; categoria: string; pos: number; faixa: string | null; cid: string | null; nome: string; ms: number };
const ARQ_LEGADO = resolve(join(process.cwd(), '.runtime', 'pilotos-laptime.json'));
let rankAntigo: RankAntigo[] = [];
let legadoCarregado = false;
try { if (existsSync(ARQ_LEGADO)) { const arq = JSON.parse(readFileSync(ARQ_LEGADO, 'utf8')); rankAntigo = arq.rankings ?? []; legadoCarregado = arq.versao === 6 && rankAntigo.length > 0 && Object.keys(indice).some((k) => k.startsWith('lt-')); } } catch { rankAntigo = []; }

async function carregarLegado(log?: (m: string) => void) {
  // O histórico dos sistemas antigos (2018 a set/2026) já está gravado no índice (.runtime/pilotos-cronometragem.json,
  // baterias "lt-", "lr-" e "cx-") e no ranking antigo (.runtime/pilotos-laptime.json). Não muda mais e não há banco
  // antigo para reler: só marca como carregado.
  legadoCarregado = true;
  if (!rankAntigo.length) log?.('pilotos: ranking antigo não encontrado em .runtime (o histórico de corridas continua no índice)');
}
// ---------------------------------------------------------------- CalXPro (sistema anterior ao LapTime, banco CALXPRO do SRVKART, só leitura)
// Corridas de 2023 a jan/2025 com posição, voltas e melhor volta de cada piloto. O CalXPro não guardava o cliente da
// recepção na corrida, só nome e e-mail: o piloto é ligado ao cadastro unificado pelo e-mail (só quando o e-mail é de
// um cliente só). Lido uma vez (os dados não mudam mais) e guardado no índice com o prefixo "cx-".
// versão 2: e-mail repetido em cadastros duplicados da mesma pessoa também liga a corrida antiga (antes ficava sem dono)
const ARQ_CALXPRO_VERSAO = resolve(join(process.cwd(), '.runtime', 'pilotos-calxpro-versao.txt'));
const CALXPRO_VERSAO = '3';
let calxproCarregado = Object.keys(indice).some((k) => k.startsWith('cx-')) && (() => { try { return readFileSync(ARQ_CALXPRO_VERSAO, 'utf8').trim() === CALXPRO_VERSAO; } catch { return false; } })();
async function carregarCalxpro(_log?: (m: string) => void) {
  // histórico 2018-2025 já gravado no índice ("cx-"); nada a reler
  calxproCarregado = true;
  return false;
}

/** Primeiro dia com corrida detalhada (LapTime ou cronometragem nova): antes disso, só o ranking antigo do LapTime. */
// CalXPro (cx-) e reservas do LapTime (lr-) não contam: o ranking antigo do LapTime (2025-2026) cobre esse período
let inicioDetalhadoCache: { versao: number; valor: string } | null = null;
// varre o índice inteiro (regex por bateria): guarda por versão do índice — o ranking chamava isso centenas de vezes por ciclo
const inicioDetalhado = () => {
  if (inicioDetalhadoCache && inicioDetalhadoCache.versao === indiceVersao) return inicioDetalhadoCache.valor;
  const valor = Object.values(indice).reduce((a, b) => (/^(cx|lr)-/.test(b.id) || (a && b.dia >= a) ? a : b.dia), '' as string) || '9999-12-31';
  inicioDetalhadoCache = { versao: indiceVersao, valor };
  return valor;
};

type Resumo = { baterias: number; voltas: number; vitorias: number; podios: number; ultima: string | null; primeira: string | null; melhor: { ms: number; tracado: string } | null };
/** Resumo da carreira de cada cliente (cid), calculado do índice. */
function carreiras() {
  const m = new Map<string, Resumo>();
  for (const b of Object.values(indice)) for (const p of b.pilotos) {
    if (!p.cid) continue;
    const r = m.get(p.cid) ?? { baterias: 0, voltas: 0, vitorias: 0, podios: 0, ultima: null, primeira: null, melhor: null };
    r.baterias++; r.voltas += p.voltas;
    if (b.tipo === 'corrida' && !p.dq && p.pos >= 1) { if (p.pos === 1) r.vitorias++; if (p.pos <= 3) r.podios++; }
    if (!r.ultima || b.dia > r.ultima) r.ultima = b.dia;
    if (!r.primeira || b.dia < r.primeira) r.primeira = b.dia;
    if (!b.chuva && !p.dq && valeNoRanking(tk(b, p), p.melhor) && p.melhor && (!r.melhor || p.melhor < r.melhor.ms)) r.melhor = { ms: p.melhor, tracado: tk(b, p) };
    m.set(p.cid, r);
  }
  return m;
}

type Periodo = { nome: string; de: string | null; ate: string | null; ref: string | null; anterior: string | null; proximo: string | null };
/** Semana (domingo a sábado) ou mês que contém `ref` (padrão: hoje); `anterior`/`proximo` andam um período. */
function periodo(nome: string, refPedida?: string | null): Periodo {
  const hoje = hojeSp();
  if (nome === 'semana') {
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(refPedida ?? '') ? refPedida! : hoje;
    const de = somaDias(ref, -new Date(ref + 'T12:00:00Z').getUTCDay()), ate = somaDias(de, 6);
    return { nome, de, ate, ref: de, anterior: somaDias(de, -7), proximo: ate < hoje ? somaDias(de, 7) : null };
  }
  if (nome === 'mes') {
    const ref = /^\d{4}-\d{2}$/.test(refPedida ?? '') ? refPedida! : hoje.slice(0, 7);
    const [a, m] = ref.split('-').map(Number), mes = (x: number, y: number) => `${y + Math.floor((x - 1) / 12)}-${String(((x - 1) % 12 + 12) % 12 + 1).padStart(2, '0')}`;
    return { nome, de: ref + '-01', ate: ref + '-31', ref, anterior: mes(m - 1, a), proximo: ref < hoje.slice(0, 7) ? mes(m + 1, a) : null };
  }
  return { nome: 'geral', de: null, ate: null, ref: null, anterior: null, proximo: null };
}
type LinhaRank = { pos: number; cid: string | null; nome: string; ms: number; kart: string; bateria: string; dia: string; sessaoId: string | null; categoria: string | null; antigo?: boolean };
/** Usa o ranking antigo do LapTime quando o período começa antes das corridas detalhadas (ou no geral). */
const usaAntigo = (per: Periodo) => per.nome === 'geral' || (!!per.de && per.de < inicioDetalhado());
function antigosDo(tracado: string | null, per: Periodo) {
  if (!usaAntigo(per)) return [];
  const lim = inicioDetalhado(); // daí em diante as corridas detalhadas já contam (sem duplicar)
  return rankAntigo.filter((x) => (!tracado || x.tracado === tracado) && x.dia < lim && (per.nome === 'geral' || (x.tipo === (per.nome === 'semana' ? 'semana' : 'mes') && (!per.de || x.dia >= per.de) && (!per.ate || x.dia <= per.ate))));
}
/** Melhor volta de cada piloto num traçado e período (um tempo por piloto), juntando cronometragem nova, corridas do LapTime e o ranking antigo. */
type ItemRank = { b: BateriaCrono; p: Corrida };
/** Uma passagem pelo índice para o período: separa por traçado os tempos que valem (evita varrer o índice inteiro por traçado). */
async function itensPorTracado(per: Periodo): Promise<Map<string, ItemRank[]>> {
  const m = new Map<string, ItemRank[]>();
  let n = 0;
  for (const b of Object.values(indice)) {
    if (!b.chuva && !(per.de && b.dia < per.de) && !(per.ate && b.dia > per.ate)) {
      for (const p of b.pilotos) {
        if (!p.melhor || p.dq) continue;
        const t = tk(b, p);
        if (!valeNoRanking(t, p.melhor)) continue;
        const l = m.get(t); if (l) l.push({ b, p }); else m.set(t, [{ b, p }]);
      }
    }
    if ((++n & 255) === 255) await new Promise<void>((r) => setImmediate(r));
  }
  return m;
}
function ranking(tracado: string, per: Periodo, itens?: Map<string, ItemRank[]>): LinhaRank[] {
  const melhor = new Map<string, LinhaRank>();
  const por = (cid: string | null, nome: string) => (cid ? 'c' + cid : 'n' + nome.toLowerCase());
  const fonte: Iterable<ItemRank> = itens ? (itens.get(tracado) ?? []) : (function* () {
    for (const b of Object.values(indice)) {
      if (b.chuva) continue;
      if (per.de && b.dia < per.de) continue;
      if (per.ate && b.dia > per.ate) continue;
      for (const p of b.pilotos) if (tk(b, p) === tracado && p.melhor && !p.dq && valeNoRanking(tracado, p.melhor)) yield { b, p };
    }
  })();
  {
    for (const { b, p } of fonte) {
      if (!p.melhor) continue;
      const k = por(p.cid, p.nome), at = melhor.get(k);
      if (at && at.ms <= p.melhor) continue;
      melhor.set(k, { pos: 0, cid: p.cid, nome: p.nome, ms: p.melhor, kart: p.kart, bateria: b.nome, dia: b.dia, sessaoId: b.id.startsWith('lt-') ? null : b.id, categoria: catDoKart(p.kart) ?? nomeCategoria(p.cat), antigo: b.id.startsWith('lt-') });
    }
  }
  for (const x of antigosDo(tracado, per)) {
    if (!valeNoRanking(x.tracado, x.ms)) continue;
    const k = por(x.cid, x.nome), at = melhor.get(k);
    if (at && at.ms <= x.ms) continue;
    melhor.set(k, { pos: 0, cid: x.cid, nome: x.nome, ms: x.ms, kart: '', bateria: 'LapTime', dia: x.dia, sessaoId: null, categoria: x.categoria, antigo: true });
  }
  // a mesma pessoa às vezes vem do LapTime sem cadastro ligado: junta pelo nome com quem tem cadastro (fica o melhor tempo)
  const comCadastro = new Map<string, string>();
  for (const [k, l] of melhor) if (l.cid) comCadastro.set(chaveNome(l.nome), k);
  for (const [k, l] of [...melhor]) {
    if (l.cid) continue;
    const kc = comCadastro.get(chaveNome(l.nome)); if (!kc) continue;
    const c = melhor.get(kc)!;
    if (l.ms < c.ms) melhor.set(kc, { ...l, cid: c.cid, nome: c.nome });
    melhor.delete(k);
  }
  return [...melhor.values()].sort((a, b) => a.ms - b.ms).map((l, i) => ({ ...l, pos: i + 1 }));
}
function tracadosComTempos(per: Periodo, itens?: Map<string, ItemRank[]>) {
  const conta = new Map<string, Set<string>>();
  const add = (t: string, k: string) => { const s = conta.get(t) ?? new Set<string>(); s.add(k); conta.set(t, s); };
  if (itens) { for (const [t, l] of itens) for (const { p } of l) add(t, p.cid ? 'c' + p.cid : 'n' + chaveNome(p.nome)); }
  else for (const b of Object.values(indice)) {
    if (b.chuva || (per.de && b.dia < per.de) || (per.ate && b.dia > per.ate)) continue;
    for (const p of b.pilotos) if (p.melhor && !p.dq && valeNoRanking(tk(b, p), p.melhor)) add(tk(b, p), p.cid ? 'c' + p.cid : 'n' + chaveNome(p.nome));
  }
  for (const x of antigosDo(null, per)) if (valeNoRanking(x.tracado, x.ms)) add(x.tracado, x.cid ? 'c' + x.cid : 'n' + chaveNome(x.nome));
  return [...conta.entries()].map(([nome, s]) => ({ nome, pilotos: s.size, superKart: /super kart/i.test(nome) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}

// ---------------------------------------------------------------- cartela
const COLS_LISTA = `c.id, c.nome, to_char(c.nascimento, 'YYYY-MM-DD') nascimento, c.peso, c.telefone, c.email,
  c.instagram, c.documento, c.responsavel_id "responsavelId", r.nome "responsavelNome", c.bloqueado, c.origem,
  to_char(c.criado_em, 'YYYY-MM-DD') "criadoEm", case when f.cliente_id is null then 0 else 1 end "temFoto"`;
const DE_LISTA = `from kart.cliente c left join kart.cliente r on r.id = c.responsavel_id left join kart.cliente_foto f on f.cliente_id = c.id`;
const INCOMPLETO = `(c.responsavel_id is null and (c.documento_num is null or c.peso is null or c.telefone_num is null or c.email is null))`;
const POR_PAGINA = 50;

async function hojeNaPista() {
  return query<{ id: number; hora: string }>(
    `select i.cliente_id id, min(to_char(b.inicio, 'HH24:MI')) hora from kart.inscricao i join kart.bateria b on b.id = i.bateria_id
      where i.status <> 'cancelada' and b.inicio::date = current_date group by i.cliente_id`,
  );
}
async function porIds(ids: number[]) {
  if (!ids.length) return [];
  const p = Object.fromEntries(ids.map((id, i) => ['i' + i, id]));
  const rows = await query<Record<string, unknown>>(`select ${COLS_LISTA} ${DE_LISTA} where c.id in (${ids.map((_, i) => '@i' + i).join(',')})`, p);
  const ordem = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (ordem.get(a.id as number) ?? 0) - (ordem.get(b.id as number) ?? 0));
}
/** Possível cadastro duplicado: mesmo CPF, ou mesmo nome com o mesmo telefone ou a mesma data de nascimento. */
async function duplicadosDe(ids: number[]) {
  if (!ids.length) return new Map<number, { id: number; nome: string }>();
  const p = Object.fromEntries(ids.map((id, i) => ['i' + i, id]));
  const rows = await query<{ id: number; outro: number; nome: string }>(
    `select c.id, min(o.id) outro, min(o.nome) nome from kart.cliente c join kart.cliente o on o.id <> c.id and (
        (c.documento_num is not null and length(c.documento_num) >= 11 and o.documento_num = c.documento_num)
        or (lower(o.nome) = lower(c.nome) and ((c.telefone_num is not null and o.telefone_num = c.telefone_num) or (c.nascimento is not null and o.nascimento = c.nascimento))))
      where c.id in (${ids.map((_, i) => '@i' + i).join(',')}) and not (coalesce(o.responsavel_id = c.id, false) or coalesce(c.responsavel_id = o.id, false)) group by c.id`,
    p,
  );
  return new Map(rows.map((r) => [r.id, { id: r.outro, nome: r.nome }]));
}
async function completar(rows: Record<string, unknown>[], hoje: Map<number, string>, car: Map<string, Resumo>) {
  const dup = await duplicadosDe(rows.map((c) => c.id as number));
  return rows.map((c) => {
    const faltas = c.responsavelId ? [] : [!c.documento && 'CPF', !c.peso && 'peso', !c.telefone && 'telefone', !c.email && 'e-mail'].filter(Boolean);
    return { ...c, faltas, hoje: hoje.get(c.id as number) ?? null, carreira: car.get(String(c.id)) ?? null, duplicado: dup.get(c.id as number) ?? null };
  });
}

// ---------------------------------------------------------------- conta do app (fala com o app pela chave de administração)
function baseApp() {
  const base = process.env.MOBILE_IDENTITY_LINK_URL && process.env.MOBILE_ADMIN_TOKEN
    ? mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL, '/api/mobile/v1/internal/identity-links') : null;
  if (!base) throw new HttpError(503, 'Integração com o app não configurada neste servidor.');
  return base;
}
async function chamarApp(corpo: Record<string, unknown>) {
  const r = await fetch(new URL('/api/mobile/v1/internal/conta-admin', baseApp()), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN! },
    body: JSON.stringify(corpo), redirect: 'error', signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!r) throw new HttpError(502, 'O app não respondeu. Tente de novo.');
  const j = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (!r.ok) throw new HttpError(r.status === 401 || r.status === 503 ? 502 : r.status, String(j.erro ?? 'Falha na conta do app.'));
  return j;
}
type StatusApp = Record<string, { s: 'ativo' | 'convidado'; u?: number }>;
let statusCache: { em: number; v: StatusApp } | null = null;
export async function statusApp(fresco = false): Promise<StatusApp> {
  if (!fresco && statusCache && Date.now() - statusCache.em < 60_000) return statusCache.v;
  try { statusCache = { em: Date.now(), v: (await chamarApp({ acao: 'status' })).status ?? {} }; }
  catch { if (!statusCache) return {}; }
  return statusCache!.v;
}
// e-mails que a caixa do destinatário recusou (webhook do Resend no Worker do app): a recepção vê "E-mail voltou"
type EmailVoltou = { motivo: string; assunto: string; em: number };
let voltaramCache: { em: number; v: Record<string, EmailVoltou> } | null = null;
export async function emailsQueVoltaram(): Promise<Record<string, EmailVoltou>> {
  if (voltaramCache && Date.now() - voltaramCache.em < 5 * 60_000) return voltaramCache.v;
  try { voltaramCache = { em: Date.now(), v: (await chamarApp({ acao: 'emails-que-voltaram' })).emails ?? {} }; }
  catch { if (!voltaramCache) return {}; }
  return voltaramCache!.v;
}
const emailVoltouDe = (lista: Record<string, EmailVoltou>, email: unknown) => (typeof email === 'string' && email.trim() ? lista[email.trim().toLowerCase()] ?? null : null);

async function contaApp(id: number, acao: string, b: Record<string, unknown>, quem: string) {
  if (!['consultar', 'criar', 'editar', 'senha', 'convite'].includes(acao)) throw new HttpError(400, 'Ação desconhecida.');
  const c = await one<{ nome: string; doc: string | null; email: string | null; fone: string | null }>(
    `select nome, documento_num doc, email, telefone_num fone from kart.cliente where id = @id`, { id });
  if (!c) throw new HttpError(404, 'Cliente não encontrado.');
  baseApp();
  const cpf = onlyDigits(String(c.doc ?? ''));
  const cliente = { email: c.email, telefone: c.fone };
  if (cpf.length !== 11) return { semCpf: true, conta: null, cliente } as Record<string, any>;
  const corpo = {
    acao, cpf, clienteId: String(id), nome: c.nome, telefone: onlyDigits(String(c.fone ?? '')),
    email: String(b.email ?? c.email ?? '').trim(),
    novoEmail: String(b.novoEmail ?? '').trim(), novoCpf: onlyDigits(String(b.novoCpf ?? '')),
    senha: String(b.senha ?? ''), enviarEmail: b.enviarEmail === true,
  };
  const j = await chamarApp(corpo);
  if (acao !== 'consultar') {
    console.log(`app: ${acao} da conta do cliente ${id} por ${quem}`);
    statusCache = null;
    // CPF/e-mail trocados na conta: a ficha acompanha, senão a conta e o cadastro se desencontram
    if (acao === 'editar' && corpo.novoCpf && corpo.novoCpf !== cpf) await query(`update kart.cliente set documento_num = @d where id = @id`, { d: corpo.novoCpf, id });
    if (acao === 'editar' && corpo.novoEmail) await query(`update kart.cliente set email = @e where id = @id`, { e: corpo.novoEmail.toLowerCase(), id });
    if (acao === 'criar' && corpo.email && !c.email) await query(`update kart.cliente set email = @e where id = @id`, { e: corpo.email.toLowerCase(), id });
    await publicarHistoricoDoCliente(String(id)).catch(() => 0); // histórico no app na hora
  }
  return { ...j, cliente } as Record<string, any>;
}

/**
 * Foto do cadastro espelhada no app do piloto (Android/iOS): o app mostra fotos-app/<cliente>.jpg do servidor de cadastro.
 * Não segura a resposta da Recepção: se o site não responder, só registra no log (a próxima troca de foto reenvia).
 */
export async function espelharFotoNoApp(clienteId: number, foto: Buffer | null, log: (...a: unknown[]) => void = console.log): Promise<boolean> {
  const base = (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
  const chave = process.env.PRECADASTRO_KEY || '';
  if (!base || !chave) return false;
  try {
    const r = await fetch(`${base}/api/sync/foto-app/${clienteId}`, {
      method: foto ? 'PUT' : 'DELETE',
      headers: { 'x-sync-key': chave, ...(foto ? { 'content-type': 'application/octet-stream' } : {}) },
      body: foto ? new Uint8Array(foto) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) log(`foto do cliente ${clienteId}: o app recusou (${r.status})`);
    return r.ok;
  } catch (e) {
    log(`foto do cliente ${clienteId}: o app não respondeu (${(e as Error).message})`);
    return false;
  }
}

export async function pilotosRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  let m: RegExpMatchArray | null;

  if (path === '/pilotos/resumo' && method === 'GET') {
    await indiceFresco();
    const [base] = await query<Record<string, number>>(
      `select count(*) total, sum(case when legado_id is not null then 1 else 0 end) legado,
              sum(case when criado_em >= now() - interval '7 days' and origem <> 'legado' then 1 else 0 end) novos,
              sum(case when responsavel_id is null and (documento_num is null or peso is null or telefone_num is null or email is null) then 1 else 0 end) incompletos,
              sum(case when extract(month from nascimento) = extract(month from now()) then 1 else 0 end) aniversariantes
         from kart.cliente`,
    );
    const lim = somaDias(hojeSp(), -30), ativos = new Set<string>();
    for (const b of Object.values(indice)) if (b.dia >= lim) for (const p of b.pilotos) if (p.cid) ativos.add(p.cid);
    const novosOrigem = await query<{ origem: string; n: number }>(`select origem, count(*) n from kart.cliente where criado_em >= now() - interval '7 days' and origem <> 'legado' group by origem`);
    send(200, { ...base, ativos30: ativos.size, hoje: (await hojeNaPista()).length, novosOrigem, baterias: Object.keys(indice).length, desde: Object.values(indice).reduce((a, b) => (!a || b.dia < a ? b.dia : a), '' as string) || null, atualizadoEm, erroCronometragem: ultimoErro });
    return true;
  }

  if (path === '/pilotos' && method === 'GET') {
    await indiceFresco();
    const filtro = url.searchParams.get('filtro') || 'todos';
    const q = String(url.searchParams.get('q') ?? '').trim();
    const pagina = Math.max(1, Math.min(4000, Number(url.searchParams.get('pagina')) || 1));
    const porPag = Number(url.searchParams.get("por")) === 20 ? 20 : POR_PAGINA; // celular pede 20
    const ini = (pagina - 1) * porPag;
    const hojeLista = await hojeNaPista(), hoje = new Map(hojeLista.map((h) => [h.id, h.hora]));
    await new Promise<void>((r) => setImmediate(r));
  const car = carreiras();
  await new Promise<void>((r) => setImmediate(r));
    // ordem: recentes (padrão) | nome | baterias | melhor (as duas últimas só nas listas que vêm da carreira)
    const ordem = ['nome', 'baterias', 'melhor'].includes(url.searchParams.get('ordem') ?? '') ? url.searchParams.get('ordem')! : 'recentes';
    let rows: Record<string, unknown>[] = [], total = 0;
    if (q.length >= 2) {
      const d = onlyDigits(q);
      const where = q.includes('@') ? 'lower(c.email) like @q' : d.length >= 4 && d.length === q.replace(/[\s.\-()/]/g, '').length ? '(c.documento_num like @d or c.telefone_num like @t)' : 'unaccent(c.nome) ilike unaccent(@n)';
      rows = await query(`select ${COLS_LISTA} ${DE_LISTA} where ${where} order by c.nome limit 100`, { q: q.toLowerCase() + '%', d: d + '%', t: '%' + d, n: '%' + q.replace(/\s+/g, '%') + '%' });
      total = rows.length;
    } else if (filtro === 'hoje' || filtro === 'ativos' || filtro === 'app' || filtro === 'convidados') {
      let ids: number[];
      if (filtro === 'hoje') ids = hojeLista.sort((a, b) => a.hora.localeCompare(b.hora)).map((h) => h.id);
      else if (filtro === 'app' || filtro === 'convidados') {
        const st = await statusApp();
        ids = Object.entries(st).filter(([, v]) => (filtro === 'app' ? v.s === 'ativo' : v.s === 'convidado'))
          .sort((a, b) => (b[1].u ?? 0) - (a[1].u ?? 0)).map(([k]) => Number(k)).filter((n) => n > 0);
      }
      else {
        const lim = somaDias(hojeSp(), -30);
        const cmp = ordem === 'baterias' ? (a: [string, Resumo], b: [string, Resumo]) => b[1].baterias - a[1].baterias
          : ordem === 'melhor' ? (a: [string, Resumo], b: [string, Resumo]) => (a[1].melhor?.ms ?? 1e12) - (b[1].melhor?.ms ?? 1e12)
            : (a: [string, Resumo], b: [string, Resumo]) => String(b[1].ultima).localeCompare(String(a[1].ultima)) || b[1].baterias - a[1].baterias;
        ids = [...car.entries()].filter(([, r]) => r.ultima && r.ultima >= lim).sort(cmp).map(([id]) => Number(id)).filter((n) => n > 0);
      }
      if (ordem === 'nome' && filtro === 'hoje') { const nomes = new Map((await porIds(ids)).map((r) => [r.id as number, String(r.nome)])); ids.sort((a, b) => String(nomes.get(a)).localeCompare(String(nomes.get(b)), 'pt-BR')); }
      total = ids.length;
      rows = await porIds(ids.slice(ini, ini + porPag));
    } else {
      const where = filtro === 'novos' ? `c.criado_em >= now() - interval '7 days' and c.origem <> 'legado'`
        : filtro === 'incompletos' ? INCOMPLETO
          : filtro === 'aniversariantes' ? 'extract(month from c.nascimento) = extract(month from now())' : 'true';
      const ordemSql = ordem === 'nome' ? 'c.nome, c.id' : filtro === 'aniversariantes' ? 'extract(day from c.nascimento), c.nome' : 'c.atualizado_em desc, c.id desc';
      total = (await one<{ n: number }>(`select count(*) n from kart.cliente c where ${where}`))?.n ?? 0;
      rows = await query(`select ${COLS_LISTA} ${DE_LISTA} where ${where} order by ${ordemSql} offset @ini limit ${porPag}`, { ini });
    }
    const [st, voltaram] = await Promise.all([statusApp(), emailsQueVoltaram()]);
    const linhas = (await completar(rows, hoje, car)).map((l) => ({ ...l, app: st[String((l as { id?: unknown }).id)]?.s ?? null,
      emailVoltou: emailVoltouDe(voltaram, (l as { email?: unknown }).email) }));
    send(200, { total, pagina, porPagina: porPag, ordem, linhas, atualizadoEm });
    return true;
  }

  if ((m = path.match(/^\/pilotos\/(\d+)$/)) && method === 'GET') {
    await indiceFresco();
    const id = Number(m[1]);
    const c = await one<Record<string, unknown>>(`select ${CLIENTE_COLS}, r.nome "responsavelNome", c.legado_id "legadoId", case when f.cliente_id is null then 0 else 1 end "temFoto"
      from kart.cliente c left join kart.cliente r on r.id = c.responsavel_id left join kart.cliente_foto f on f.cliente_id = c.id where c.id = @id`, { id });
    if (!c) throw new HttpError(404, 'Cliente não encontrado.');
    const cid = String(id);
    const corridas = Object.values(indice).flatMap((b) => b.pilotos.filter((p) => p.cid === cid).map((p) => ({ sessaoId: b.id, dia: b.dia, inicio: b.inicio, bateria: b.nome, tipo: b.tipo, tracado: tk(b, p), chuva: b.chuva, pos: p.pos, de: b.pilotos.length, voltas: p.voltas, melhor: p.melhor, kart: p.kart, dq: p.dq })))
      .sort((a, b) => b.inicio - a.inicio);
    const sem = periodo('semana'), mes = periodo('mes');
    const porTracado = new Map<string, { ms: number; dia: string; bateria: string }>();
    for (const x of corridas) if (!x.chuva && !x.dq && x.melhor && valeNoRanking(x.tracado, x.melhor)) { const at = porTracado.get(x.tracado); if (!at || x.melhor < at.ms) porTracado.set(x.tracado, { ms: x.melhor, dia: x.dia, bateria: x.bateria }); }
    const meusAntigos = rankAntigo.filter((x) => x.cid === cid);
    for (const x of meusAntigos) { if (!valeNoRanking(x.tracado, x.ms)) continue; const at = porTracado.get(x.tracado); if (!at || x.ms < at.ms) porTracado.set(x.tracado, { ms: x.ms, dia: x.dia, bateria: 'ranking antigo' }); }
    const tracados = [...porTracado.entries()].map(([nome, t]) => {
      const rs = ranking(nome, sem), rm = ranking(nome, mes), rg = ranking(nome, periodo('geral'));
      const posDe = (r: LinhaRank[]) => { const l = r.find((x) => x.cid === cid); return l ? { pos: l.pos, de: r.length } : null; };
      return { nome, ...t, semana: posDe(rs), mes: posDe(rm), geral: posDe(rg), corridas: corridas.filter((x) => x.tracado === nome).length };
    }).sort((a, b) => b.corridas - a.corridas || a.ms - b.ms);
    // ranking mensal do LapTime antigo: melhor posição de cada mês/traçado (o LapTime separava por faixa de peso e categoria)
    const porMes = new Map<string, RankAntigo>();
    for (const x of meusAntigos.filter((y) => y.tipo === 'mes' && valeNoRanking(y.tracado, y.ms))) { const k = x.periodo + '|' + x.tracado; const at = porMes.get(k); if (!at || x.ms < at.ms) porMes.set(k, x); }
    const laptime = [...porMes.values()].sort((a, b) => b.dia.localeCompare(a.dia) || a.ms - b.ms).slice(0, 40).map((x) => ({ periodo: x.periodo, dia: x.dia, tracado: x.tracado, categoria: x.categoria, pos: x.pos, faixa: x.faixa, ms: x.ms }));
    const semanasTop = new Set(meusAntigos.filter((y) => y.tipo === 'semana').map((y) => y.periodo + y.tracado)).size;
    const principal = tracados[0]?.nome ?? null;
    const evolucao = principal ? corridas.filter((x) => x.tracado === principal && !x.chuva && x.melhor && !x.dq).slice(0, 12).reverse().map((x) => ({ dia: x.dia, ms: x.melhor, bateria: x.bateria })) : [];
    const dependentes = await query(`select id, nome, to_char(nascimento, 'YYYY-MM-DD') nascimento from kart.cliente where responsavel_id = @id order by nome`, { id });
    const financeiro = await one(`select count(*) vendas, coalesce(sum(final_centavos), 0) total, to_char(max(criado_em), 'YYYY-MM-DD"T"HH24:MI') ultima from kart.venda where cliente_id = @id and not cancelada`, { id });
    const hoje = (await hojeNaPista()).find((h) => h.id === id)?.hora ?? null;
    const resumo = carreiras().get(cid) ?? null;
    const duplicado = (await duplicadosDe([id])).get(id) ?? null;
    const validos = meusAntigos.filter((y) => valeNoRanking(y.tracado, y.ms));
    const melhorPos = validos.reduce((min, y) => Math.min(min, y.pos), Infinity);
    const laptimeResumo = validos.length ? { meses: porMes.size, melhorPos: Number.isFinite(melhorPos) ? melhorPos : null, vitorias: new Set(validos.filter((y) => y.pos === 1).map((y) => y.tipo + y.periodo + y.tracado)).size } : null;
    send(200, { cliente: { ...c, emailVoltou: emailVoltouDe(await emailsQueVoltaram(), (c as { email?: unknown }).email) }, hoje, resumo, tracados, principal, evolucao, laptime, semanasTop, laptimeResumo, duplicado, corridas: corridas.slice(0, 200), totalCorridas: corridas.length, dependentes, financeiro, desde: Object.values(indice).reduce((a, b) => (!a || b.dia < a ? b.dia : a), '' as string) || null });
    return true;
  }

  if (path === '/pilotos/app-status' && method === 'GET') { send(200, { status: await statusApp(url.searchParams.get('fresco') === '1') }); return true; }

  // convite em lote (lista de Pilotos): cria a conta de quem tem CPF + e-mail e manda o convite por e-mail
  if (path === '/pilotos/app-lote' && method === 'POST') {
    const b = await req.body();
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);
    if (!ids.length) throw new HttpError(400, 'Escolha os pilotos.');
    const resultados: { id: number; ok: boolean; msg: string }[] = [];
    for (const id of ids) {
      try {
        let r = await contaApp(id, 'consultar', {}, req.sessao.nome);
        if (r.semCpf) { resultados.push({ id, ok: false, msg: 'sem CPF' }); continue; }
        if (!r.conta) {
          if (!r.cliente?.email) { resultados.push({ id, ok: false, msg: 'sem e-mail' }); continue; }
          r = await contaApp(id, 'criar', {}, req.sessao.nome);
        }
        r = await contaApp(id, 'convite', { enviarEmail: true }, req.sessao.nome);
        resultados.push({ id, ok: Boolean(r.emailEnviado), msg: r.emailEnviado ? 'convite enviado' : 'e-mail não saiu' });
      } catch (er) { resultados.push({ id, ok: false, msg: er instanceof Error ? er.message : 'falhou' }); }
    }
    statusCache = null;
    send(200, { resultados });
    return true;
  }

  // conta do app do piloto (painel > Pilotos): consulta, cria, troca e-mail/CPF/senha e gera o convite (e-mail ou WhatsApp).
  if ((m = path.match(/^\/pilotos\/(\d+)\/app$/)) && (method === 'GET' || method === 'POST')) {
    const b = method === 'POST' ? await req.body() : {};
    send(200, await contaApp(Number(m[1]), method === 'GET' ? 'consultar' : String(b.acao ?? ''), b, req.sessao.nome));
    return true;
  }

  if ((m = path.match(/^\/pilotos\/(\d+)\/foto$/))) {
    const id = Number(m[1]);
    if (method === 'GET') {
      const f = await one<{ Foto: Buffer; Miniatura: Buffer; Tipo: string }>(`select foto "Foto", miniatura "Miniatura", tipo "Tipo" from kart.cliente_foto where cliente_id = @id`, { id });
      if (!f) throw new HttpError(404, 'Piloto sem foto.');
      const b = url.searchParams.get('mini') === '1' ? f.Miniatura : f.Foto;
      send(200, { foto: `data:${f.Tipo};base64,${Buffer.from(b).toString('base64')}` });
      return true;
    }
    if (method === 'PUT') {
      const b = await req.body();
      const dec = (v: unknown, max: number) => {
        const s = String(v ?? ''); const mm = s.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!mm) throw new HttpError(400, 'Envie a foto em JPG, PNG ou WEBP.');
        const buf = Buffer.from(mm[2], 'base64');
        if (buf.length > max) throw new HttpError(413, 'A foto ficou grande demais. Escolha outra imagem.');
        return { tipo: mm[1], buf };
      };
      const foto = dec(b.foto, 400_000), mini = dec(b.miniatura, 40_000);
      if (!(await one(`select 1 x from kart.cliente where id = @id`, { id }))) throw new HttpError(404, 'Cliente não encontrado.');
      await query(
        `insert into kart.cliente_foto (cliente_id, foto, miniatura, tipo, atualizado_por) values (@id, @foto, @mini, @tipo, @uid)
         on conflict (cliente_id) do update set foto = excluded.foto, miniatura = excluded.miniatura, tipo = excluded.tipo, atualizado_por = excluded.atualizado_por, atualizado_em = now()`,
        { id, foto: foto.buf, mini: mini.buf, tipo: foto.tipo, uid: req.sessao.uid },
      );
      // a foto veio do próprio app (CRM puxou a do app para o cadastro): não precisa voltar para lá
      const noApp = b.origem === 'app' ? true : await espelharFotoNoApp(id, foto.buf);
      send(200, { ok: true, noApp });
      return true;
    }
    if (method === 'DELETE') {
      await query(`delete from kart.cliente_foto where cliente_id = @id`, { id });
      const noApp = await espelharFotoNoApp(id, null);
      send(200, { ok: true, noApp });
      return true;
    }
  }

  if (path === '/pilotos/miniaturas' && method === 'GET') {
    const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
    if (!ids.length) { send(200, {}); return true; }
    const p = Object.fromEntries(ids.map((id, i) => ['i' + i, id]));
    const rows = await query<{ id: number; Miniatura: Buffer; Tipo: string }>(`select cliente_id id, miniatura "Miniatura", tipo "Tipo" from kart.cliente_foto where cliente_id in (${ids.map((_, i) => '@i' + i).join(',')})`, p);
    send(200, Object.fromEntries(rows.map((r) => [r.id, `data:${r.Tipo};base64,${Buffer.from(r.Miniatura).toString('base64')}`])));
    return true;
  }

  if (path === '/pilotos/ranking' && method === 'GET') {
    await indiceFresco();
    const per = periodo(url.searchParams.get('periodo') || 'semana', url.searchParams.get('ref'));
    const tracados = tracadosComTempos(per);
    const pedido = url.searchParams.get('tracado');
    const escolhido = tracados.find((t) => t.nome === pedido) ?? tracados.slice().sort((a, b) => b.pilotos - a.pilotos)[0] ?? null;
    const top = Math.max(1, Math.min(500, Number(url.searchParams.get('top')) || 50));
    const todas = escolhido ? ranking(escolhido.nome, per) : [];
    const linhas = todas.slice(0, top);
    const ids = linhas.map((l) => Number(l.cid)).filter((n) => n > 0);
    const extras = ids.length ? await query<{ id: number; nascimento: string | null; sexo: string | null; temFoto: number }>(
      `select c.id, to_char(c.nascimento, 'YYYY-MM-DD') nascimento, c.sexo, case when f.cliente_id is null then 0 else 1 end "temFoto" from kart.cliente c left join kart.cliente_foto f on f.cliente_id = c.id where c.id in (${ids.map((_, i) => '@i' + i).join(',')})`,
      Object.fromEntries(ids.map((id, i) => ['i' + i, id])),
    ) : [];
    const ex = new Map(extras.map((e) => [String(e.id), e]));
    send(200, { periodo: per, antigo: usaAntigo(per) && per.nome !== 'geral', comAntigo: usaAntigo(per), inicioDetalhado: inicioDetalhado(), tracados, tracado: escolhido?.nome ?? null, total: todas.length, linhas: linhas.map((l) => ({ ...l, ...(l.cid && ex.get(l.cid) ? { nascimento: ex.get(l.cid)!.nascimento, sexo: ex.get(l.cid)!.sexo, temFoto: !!ex.get(l.cid)!.temFoto } : {}) })), atualizadoEm, erroCronometragem: ultimoErro });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- app do cliente (público)
/** Mesmo cálculo do ranking/carreira do painel, só com o que pode ser público no app: nome, tempos, posições e
 *  contagens de corridas (nada de documento, telefone, nascimento, compras). `ranking` = top 100 de cada traçado em
 *  semana/mês/geral; `pilotos` = carreira de todo piloto com cadastro que andou desde o início do índice. */
// cache do ranking do app: a reconstrução leva ~20 s sobre o índice inteiro; só refaz quando o índice muda
// Hora (0-23) em São Paulo de um instante. O formatador é caro de criar (toLocaleString com fuso recriava um por chamada:
// ~2 milhões de chamadas por ciclo = 37 s de CPU travando o servidor, 15/11/2026): reaproveita um só e guarda por instante.
const fmtHoraSp = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
const horaSpCache = new Map<number, number>();
const horaSp = (ms: number) => {
  let h = horaSpCache.get(ms);
  if (h === undefined) { h = Number(fmtHoraSp.format(ms)) % 24; if (horaSpCache.size > 200_000) horaSpCache.clear(); horaSpCache.set(ms, h); }
  return h;
};
/** Posições de um traçado num período: { de: total, pos: { cid: posição } }. Uma linha por traçado/período no app. */
export type PosicoesTracado = { periodo: string; tracado: string; de: number; pos: Record<string, number> };
let rankingCache: { versao: number; dia: string; ranking: unknown; pilotos: unknown; posicoes: Record<string, PosicoesTracado> } | null = null;
export async function rankingPublicoParaApp() {
  await indiceFresco();
  // semana/mês viram à meia-noite mesmo sem bateria nova: o dia também invalida
  if (rankingCache && rankingCache.versao === indiceVersao && rankingCache.dia === hojeSp()) {
    return { ranking: rankingCache.ranking, pilotos: rankingCache.pilotos, posicoes: rankingCache.posicoes };
  }
  // "Na pista desde": a data do cadastro conta (cliente antigo tem corridas de antes do histórico guardado);
  // cadastros duplicados unificados ficam com a data mais antiga.
  const cadastroDesde = new Map<string, string>();
  try {
    for (const c of await query<{ id: number; em: Date | null }>('select id, criado_em em from kart.cliente where criado_em is not null', {})) {
      if (!(c.em instanceof Date) || c.em.getFullYear() < 2000) continue;
      const id = aliasCliente.get(String(c.id)) ?? String(c.id), dia = c.em.toISOString().slice(0, 10); // o banco grava a data local sem fuso
      const at = cadastroDesde.get(id); if (!at || dia < at) cadastroDesde.set(id, dia);
    }
  } catch { /* sem banco: fica só a primeira corrida */ }
  const TOP = 100;
  // Posição e total ficam fora da ficha do piloto: uma bateria nova mexe no "de" de todo mundo do traçado e isso
  // regravava ~75 mil fichas a cada publicação. Agora vira um documento por traçado/período; o Worker junta na leitura.
  const posicoes: Record<string, PosicoesTracado> = {};
  const per = { semana: periodo('semana'), mes: periodo('mes'), geral: periodo('geral') };
  const pos = new Map<string, Record<string, Record<string, { pos: number; de: number }>>>(); // cid → período → traçado → posição
  const nomes = new Map<string, string>();
  const periodos: Record<string, { de: string | null; ate: string | null; tracados: { nome: string; pilotos: number; linhas: unknown[] }[] }> = {};
  for (const [nome, p] of Object.entries(per)) {
    const itens = await itensPorTracado(p);
    const tracados = tracadosComTempos(p, itens).sort((a, b) => b.pilotos - a.pilotos);
    const listaTracados: { nome: string; pilotos: number; linhas: unknown[] }[] = [];
    for (const t of tracados) {
      const todas = ranking(t.nome, p, itens);
      const doc: PosicoesTracado = { periodo: nome, tracado: t.nome, de: todas.length, pos: {} };
      for (const l of todas) if (l.cid) doc.pos[l.cid] = l.pos;
      posicoes[`posicoes:${nome}:${slugTracado(t.nome)}`] = doc;
      for (const l of todas) if (l.cid) {
        if (!nomes.has(l.cid)) nomes.set(l.cid, l.nome);
        const porPer = pos.get(l.cid) ?? {}; (porPer[nome] ??= {})[t.nome] = { pos: l.pos, de: todas.length }; pos.set(l.cid, porPer);
      }
      listaTracados.push({ nome: t.nome, pilotos: todas.length, linhas: todas.slice(0, TOP).map((l) => ({ pos: l.pos, id: l.cid, nome: l.nome, ms: l.ms, kart: l.kart || null, dia: l.dia, categoria: l.categoria })) });
      await new Promise<void>((r) => setImmediate(r)); // cede o loop entre traçados
    }
    periodos[nome] = {
      de: p.de, ate: p.ate,
      tracados: listaTracados,
    };
  }

  const car = carreiras();
  const corridasPor = new Map<string, { dia: string; inicio: number; bateria: string; tipo: string; tracado: string; pos: number; de: number; melhor: number | null; kart: string; dq: boolean; chuva: boolean; voltaMaisRapida: boolean; reserva: boolean }[]>();
  const bateriasIndice = Object.values(indice);
  for (let ib = 0; ib < bateriasIndice.length; ib++) {
    const b = bateriasIndice[ib];
    const validos = b.pilotos.filter((p) => p.melhor && !p.dq);
    const maisRapida = validos.reduce<number | null>((min, p) => (min === null || p.melhor! < min ? p.melhor! : min), null);
    for (const p of b.pilotos) {
      if (!p.cid) continue;
      nomes.set(p.cid, p.nome);
      const l = corridasPor.get(p.cid) ?? [];
      l.push({ dia: b.dia, inicio: b.inicio, bateria: b.nome, tipo: b.tipo, tracado: tk(b, p), pos: p.pos, de: b.pilotos.length, melhor: p.melhor, kart: p.kart, dq: p.dq, chuva: b.chuva, voltaMaisRapida: !!p.melhor && p.melhor === maisRapida && validos.length > 1, reserva: !!b.reserva });
      corridasPor.set(p.cid, l);
    }
    if ((ib & 511) === 511) await new Promise<void>((r) => setImmediate(r)); // não congela o event loop (rebuild de ~20 s medido)
  }
  const pilotos: Record<string, unknown> = {};
  const antigoPor = new Map<string, RankAntigo[]>();
  for (const x of rankAntigo) if (x.cid) { const l = antigoPor.get(x.cid) ?? []; l.push(x); antigoPor.set(x.cid, l); }
  // inclui quem só aparece no ranking (LapTime antigo, sem corrida no índice novo)
  const cidsPilotos = [...new Set([...corridasPor.keys(), ...pos.keys()])];
  for (let ip = 0; ip < cidsPilotos.length; ip++) {
    const cid = cidsPilotos[ip];
    const corridas = corridasPor.get(cid) ?? [];
    corridas.sort((a, b) => b.inicio - a.inicio);
    const r = car.get(cid);
    const corridasValidas = corridas.filter((c) => c.tipo === 'corrida' && !c.dq);
    const melhorPorTracado = new Map<string, { ms: number; dia: string }>();
    for (const c of corridas) if (!c.chuva && !c.dq && c.melhor && valeNoRanking(c.tracado, c.melhor)) {
      const at = melhorPorTracado.get(c.tracado); if (!at || c.melhor < at.ms) melhorPorTracado.set(c.tracado, { ms: c.melhor, dia: c.dia });
    }
    for (const x of antigoPor.get(cid) ?? []) if (valeNoRanking(x.tracado, x.ms)) {
      const at = melhorPorTracado.get(x.tracado); if (!at || x.ms < at.ms) melhorPorTracado.set(x.tracado, { ms: x.ms, dia: x.dia });
    }
    // LapTime antigo (antes de 02/09/2026) só guardou os top 10 semanais/mensais: quantas semanas o piloto entrou nesse top
    const antigas = antigoPor.get(cid) ?? [];
    const semanasTop10 = new Set(antigas.filter((x) => x.tipo === 'semana').map((x) => x.periodo)).size;
    const mesesTop10 = new Set(antigas.filter((x) => x.tipo === 'mes').map((x) => x.periodo)).size;
    const primeiraAntiga = antigas.reduce((a, x) => (!a || x.dia < a ? x.dia : a), '' as string) || null;
    pilotos[cid] = {
      semanasTop10, mesesTop10,
      nome: nomeCadastroDe.get(cid) ?? nomes.get(cid) ?? '', // unificado: vale o nome do cadastro, não o digitado numa bateria
      ...(outrosNomesDe.get(cid)?.length ? { outrosNomes: outrosNomesDe.get(cid)!.join(' | ') } : {}),
      baterias: r?.baterias ?? corridas.length,
      corridas: corridasValidas.length,
      voltas: r?.voltas ?? 0,
      vitorias: r?.vitorias ?? 0,
      podios: r?.podios ?? 0,
      poles: corridas.filter((c) => c.tipo !== 'corrida' && !c.dq && c.pos === 1).length,
      voltasMaisRapidas: corridas.filter((c) => c.voltaMaisRapida && !c.dq).length,
      primeira: [r?.primeira, primeiraAntiga, cadastroDesde.get(cid)].filter(Boolean).sort()[0] ?? null,
      ultima: r?.ultima ?? null,
      tracados: [...melhorPorTracado.entries()].map(([nome, t]) => ({
        nome, ms: t.ms, dia: t.dia, corridas: corridas.filter((c) => c.tracado === nome).length,
        // semana/mes/geral (posição) vêm dos documentos posicoes:* — o Worker preenche na leitura
      })).sort((a, b) => b.corridas - a.corridas || a.ms - b.ms),
      // só reserva (sem posição nem tempo) não aparece em "últimas baterias": o app mostraria "0º"
      recentes: corridas.filter((c) => !c.reserva).slice(0, 15).map((c) => ({ dia: c.dia, bateria: c.bateria, tipo: c.tipo, tracado: c.tracado, pos: c.pos, de: c.de, melhor: c.melhor, kart: c.kart })),
    };
    if ((ip & 511) === 511) await new Promise<void>((r) => setImmediate(r));
  }
  // histórico de XP por mês (últimos 12), na mesma conta do app: bateria 50, pódio +50, vitória +100, pole +50, volta mais rápida +50
  let ix = 0;
  for (const [cid, lista] of corridasPor) {
    const p = pilotos[cid] as Record<string, unknown> | undefined;
    if (!p) continue;
    const porMes = new Map<string, { xp: number; baterias: number; podios: number; vitorias: number }>();
    for (const c of lista) {
      const m = porMes.get(c.dia.slice(0, 7)) ?? { xp: 0, baterias: 0, podios: 0, vitorias: 0 };
      const corrida = c.tipo === 'corrida' && !c.dq;
      m.baterias++;
      if (corrida && c.pos >= 1 && c.pos <= 3) m.podios++;
      if (corrida && c.pos === 1) m.vitorias++;
      m.xp += 50 + (corrida && c.pos >= 1 && c.pos <= 3 ? 50 : 0) + (corrida && c.pos === 1 ? 100 : 0) + (c.tipo !== 'corrida' && !c.dq && c.pos === 1 ? 50 : 0) + (c.voltaMaisRapida && !c.dq ? 50 : 0);
      porMes.set(c.dia.slice(0, 7), m);
    }
    // estatísticas completas e conquistas especiais (noturno, chuva, sequência de vitórias, corridas cheias)
    const ordem = [...lista].sort((a, b) => a.inicio - b.inicio);
    let seq = 0, maiorSeq = 0;
    for (const c of ordem) if (c.tipo === 'corrida' && !c.dq && !c.reserva) { seq = c.pos === 1 ? seq + 1 : 0; maiorSeq = Math.max(maiorSeq, seq); }
    const cheias = lista.filter((c) => c.tipo === 'corrida' && !c.dq && !c.reserva && c.de >= 10);
    p.estatisticas = {
      corridas: lista.filter((c) => c.tipo === 'corrida').length,
      classificatorias: lista.filter((c) => c.tipo === 'classificacao').length,
      treinos: lista.filter((c) => c.tipo !== 'corrida' && c.tipo !== 'classificacao').length,
      comTempo: lista.filter((c) => !c.reserva).length,
      noturnas: lista.filter((c) => horaSp(c.inicio) >= 18).length,
      vitoriasChuva: lista.filter((c) => c.chuva && c.tipo === 'corrida' && !c.dq && c.pos === 1).length,
      maiorSequenciaVitorias: maiorSeq,
      cheias: { corridas: cheias.length, vitorias: cheias.filter((c) => c.pos === 1).length, podios: cheias.filter((c) => c.pos >= 1 && c.pos <= 3).length },
      tracadosDiferentes: new Set(lista.map((c) => c.tracado)).size,
    };
    p.xpMes = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([mes, v]) => ({ mes, ...v }));
    if ((++ix & 511) === 511) await new Promise<void>((r) => setImmediate(r));
  }
  // comparativo de XP (mesma conta do app): líder geral e quem está logo acima e logo abaixo de cada piloto
  type P = { nome: string; baterias: number; podios: number; vitorias: number; poles: number; voltasMaisRapidas: number };
  const porXp = Object.entries(pilotos as Record<string, P>)
    .filter(([, p]) => p.baterias > 0)
    .map(([id, p]) => ({ id, nome: p.nome, xp: p.baterias * 50 + p.podios * 50 + p.vitorias * 100 + p.poles * 50 + p.voltasMaisRapidas * 50 }))
    .sort((a, b) => b.xp - a.xp);
  await new Promise<void>((r) => setImmediate(r));
  for (let i = 0; i < porXp.length; i++) {
    const x = porXp[i];
    (pilotos[x.id] as Record<string, unknown>).comparativo = { pos: i + 1, de: porXp.length, lider: i ? porXp[0] : null, acima: i ? porXp[i - 1] : null, abaixo: porXp[i + 1] ?? null, acimaLista: porXp.slice(Math.max(0, i - 10), i).reverse() };
    if ((i & 1023) === 1023) await new Promise<void>((r) => setImmediate(r));
  }
  // karts do último dia com baterias da cronometragem: melhor volta, melhor posição e as baterias de cada kart
  const doDia = Object.values(indice).filter((b) => !/^(lt|lr|cx)-/.test(b.id) && !b.chuva);
  const ultimoDia = doDia.reduce((a, b) => (b.dia > a ? b.dia : a), '');
  const porKart = new Map<string, { kart: string; melhorMs: number | null; melhorPos: number | null; corridas: { inicio: number; pos: number; piloto: string; ms: number | null; bateria: string; de: number }[] }>();
  for (const b of doDia.filter((x) => x.dia === ultimoDia)) for (const p of b.pilotos) {
    if (!p.kart || p.dq) continue;
    const k = porKart.get(p.kart) ?? { kart: p.kart, melhorMs: null, melhorPos: null, corridas: [] };
    const vale = p.melhor && valeNoRanking(tk(b, p), p.melhor) ? p.melhor : null;
    if (vale && (k.melhorMs === null || vale < k.melhorMs)) k.melhorMs = vale;
    if (p.pos >= 1 && (k.melhorPos === null || p.pos < k.melhorPos)) k.melhorPos = p.pos;
    k.corridas.push({ inicio: b.inicio, pos: p.pos, piloto: p.nome, ms: p.melhor, bateria: b.nome, de: b.pilotos.length });
    porKart.set(p.kart, k);
  }
  const karts = [...porKart.values()].sort((a, b) => (a.melhorMs ?? 1e12) - (b.melhorMs ?? 1e12)).map((k, i) => ({ ...k, posVolta: k.melhorMs ? i + 1 : null, corridas: k.corridas.sort((a, b) => b.inicio - a.inicio) }));
  const kartsDoDia = { dia: ultimoDia || null, karts };
  rankingCache = { versao: indiceVersao, dia: hojeSp(), ranking: { periodos, kartsDoDia }, pilotos, posicoes };
  return { ranking: { periodos, kartsDoDia }, pilotos, posicoes };
}
