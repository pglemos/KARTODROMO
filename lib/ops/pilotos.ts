/**
 * Página Pilotos do painel web: a cartela de clientes (dbo.Cliente) com a carreira de cada um na cronometragem,
 * o ranking dos melhores tempos por traçado (semana, mês e geral) e a foto do piloto (dbo.ClienteFoto).
 *
 * A carreira vem das baterias encerradas do ORBITS (GET /api/sessions e /api/sessions/:id): cada bateria encerrada é
 * lida uma vez e guardada em .runtime/pilotos-cronometragem.json (bateria encerrada não muda; se a cronometragem
 * reabrir uma, o finishedAt muda e ela é lida de novo). Só entra no ranking volta de bateria sem chuva, fora da
 * equalização, de piloto com nome (não "Kart 12") e não desclassificado.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CLIENTE_COLS, one, onlyDigits, query } from './db';
import { HttpError } from './office';
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
function normalizarNomes() {
  for (const b of Object.values(indice)) { b.tracado = tracadoBase(b.tracado); for (const p of b.pilotos) p.t = comCategoria(b.tracado, p.cat); }
  for (const x of rankAntigo) x.tracado = comCategoria(tracadoBase(x.tracado), x.categoria);
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
const valeNoRanking = (tracado: string, ms: number | null) => !!ms && !tracado.startsWith(SEM_TRACADO) && ms >= limiteDe(tracado);
const tk = (b: BateriaCrono, p: Corrida) => p.t ?? comCategoria(b.tracado, p.cat);
/** "cat-super kart" → "Super Kart"; categorias de campeonato ficam como vieram. */
const nomeCategoria = (c: string | null | undefined) => { const s = String(c ?? '').replace(/^cat-/i, '').trim(); return /super\s*kart/i.test(s) ? 'Super Kart' : /indoor/i.test(s) ? 'Indoor' : s ? s.charAt(0).toUpperCase() + s.slice(1) : null; };
const chaveNome = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function timing(caminho: string) {
  const r = await fetch(TIMING_URL + caminho, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`cronometragem HTTP ${r.status}`);
  return r.json();
}

/** Lê as baterias encerradas que ainda não estão no índice (de 3 em 3, para não pesar no ORBITS). */
export function atualizarIndice(log?: (m: string) => void): Promise<void> {
  if (atualizando) return atualizando;
  atualizando = (async () => {
    // CalXPro (2023 a jan/2025) não depende da cronometragem estar no ar: lê uma vez e grava no índice
    // LapTime antigo (banco local LapTimeMirror) também não depende da cronometragem
    try {
      if (!legadoCarregado) { await carregarLegado(log); const tmp = ARQ + '.tmp'; writeFileSync(tmp, JSON.stringify({ baterias: indice })); renameSync(tmp, ARQ); }
      if (!calxproCarregado && await carregarCalxpro(log)) { const tmp = ARQ + '.tmp'; writeFileSync(tmp, JSON.stringify({ baterias: indice })); renameSync(tmp, ARQ); }
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
            const d = await timing(`/api/sessions/${encodeURIComponent(s.id)}`);
            const comps = (d.competitors ?? []) as { kart: string; name: string; customerId: string | null; category: string | null; autoAdded: boolean }[];
            const pilotos: Corrida[] = [];
            for (const r of (d.standings ?? []) as { position: number; kart: string; name: string; laps: number; bestLapMs: number | null; desclassificado?: boolean }[]) {
              const c = comps.find((x) => x.kart === r.kart && x.name === r.name);
              if (!c || c.autoAdded || semNome(r.name, r.kart)) continue;
              pilotos.push({ cid: c.customerId ? String(c.customerId) : null, nome: r.name.trim(), kart: r.kart, pos: r.position, voltas: r.laps || 0, melhor: r.bestLapMs && r.bestLapMs > 0 ? r.bestLapMs : null, cat: c.category ?? null, dq: !!r.desclassificado });
            }
            const inicio = d.startedAt ?? d.createdAt;
            const tracado = String(d.track?.name ?? 'Traçado principal');
            indice[s.id] = { id: s.id, nome: String(d.name ?? '').split(' · ')[0] || d.name, tipo: d.type, dia: diaSp(inicio), inicio, fim: d.finishedAt ?? null, chuva: d.chuva === true || chuvaNoNome(tracado), trackId: d.track?.id ?? null, tracado: tracadoBase(tracado), pilotos };
            mudou = true;
          } catch (e) { log?.(`pilotos: bateria ${s.id} não foi lida (${(e as Error).message})`); }
        }));
      }
      normalizarNomes();
      if (mudou) { const tmp = ARQ + '.tmp'; writeFileSync(tmp, JSON.stringify({ baterias: indice })); renameSync(tmp, ARQ); }
      atualizadoEm = Date.now(); ultimoErro = null;
      if (faltam.length) log?.(`pilotos: ${faltam.length} bateria(s) lida(s) da cronometragem, ${Object.keys(indice).length} no índice`);
    } catch (e) { ultimoErro = (e as Error).message; log?.(`pilotos: cronometragem indisponível (${ultimoErro})`); }
    finally { atualizando = null; }
  })();
  return atualizando;
}
async function indiceFresco() { if (Date.now() - atualizadoEm > 120_000) await atualizarIndice(); if (!normalizado) normalizarNomes(); }

// ---------------------------------------------------------------- LapTime antigo (banco LapTimeMirror do SRVKART, só leitura)
// Corridas detalhadas só de 02/09 a 23/09/2026 (o LapTime não guardava mais que isso); rankings diário/semanal/mensal desde
// jan/2025 com os 10 primeiros de cada faixa de peso, por traçado e categoria (Indoor, Super Kart). O LapTime foi desligado em
// 23/09: os dados não mudam mais, então são lidos uma vez e guardados em .runtime/pilotos-laptime.json.
type RankAntigo = { tipo: 'semana' | 'mes'; periodo: string; dia: string; tracado: string; categoria: string; pos: number; faixa: string | null; cid: string | null; nome: string; ms: number };
const ARQ_LEGADO = resolve(join(process.cwd(), '.runtime', 'pilotos-laptime.json'));
let rankAntigo: RankAntigo[] = [];
let legadoCarregado = false;
try { if (existsSync(ARQ_LEGADO)) { const arq = JSON.parse(readFileSync(ARQ_LEGADO, 'utf8')); rankAntigo = arq.rankings ?? []; legadoCarregado = arq.versao === 6 && rankAntigo.length > 0 && Object.keys(indice).some((k) => k.startsWith('lt-')); } } catch { rankAntigo = []; }
const msDe = (t: unknown) => (t instanceof Date ? t.getTime() : null);
const tipoAntigo: Record<string, string> = { '1': 'treino', '2': 'treino', '3': 'classificacao', '4': 'corrida' };

async function carregarLegado(log?: (m: string) => void) {
  try {
    const corridas = await query<{ id: string; nome: string; tipo: string; inicio: Date; tracado: string; piloto: string; kart: string; pos: number; voltas: number; melhor: Date | null; oculto: boolean; cid: number | null; categoria: string | null }>(
      `SELECT r.Id_Racing id, r.Name nome, r.Id_RacingType tipo, r.StartDateTime inicio, t.Name tracado, rc.Competitor piloto, rc.Number kart, rc.Pos pos, rc.Lap voltas,
              rc.BestLapTime melhor, rc.IsHidden oculto, c.Id cid, cat.Name categoria
         FROM LapTimeMirror.dbo.Racing r JOIN LapTimeMirror.dbo.RacingTrack t ON t.Id_RacingTrack = r.Id_RacingTrack
         JOIN LapTimeMirror.dbo.RacingCompetitor rc ON rc.Id_Racing = r.Id_Racing
         LEFT JOIN LapTimeMirror.dbo.Category cat ON cat.Id_Category = rc.Id_Category
         LEFT JOIN LapTimeMirror.dbo.BookingCustomer bc ON bc.UniqueId = rc.BookingCustomerUId
         LEFT JOIN dbo.Cliente c ON c.LegadoId = bc.Id_Customer
        WHERE r.StartDateTime IS NOT NULL AND rc.Competitor IS NOT NULL`,
    );
    for (const k of Object.keys(indice)) if (k.startsWith('lt-')) delete indice[k];
    for (const x of corridas) {
      if (x.oculto || semNome(x.piloto ?? '', String(x.kart ?? ''))) continue;
      const id = 'lt-' + x.id, inicio = x.inicio.getTime(), tracado = comCategoria(tracadoBase(String(x.tracado ?? 'Traçado principal')), x.categoria);
      const b = indice[id] ?? (indice[id] = { id, nome: String(x.nome ?? 'Bateria').trim(), tipo: tipoAntigo[String(x.tipo)] ?? 'treino', dia: diaSp(inicio), inicio, fim: inicio, chuva: chuvaNoNome(String(x.tracado ?? '')), trackId: null, tracado, pilotos: [] });
      const ms = msDe(x.melhor);
      b.pilotos.push({ cid: x.cid ? String(x.cid) : null, nome: String(x.piloto).trim(), kart: String(x.kart ?? ''), pos: x.pos || 0, voltas: x.voltas || 0, melhor: ms && ms > 0 ? ms : null, cat: null, dq: false });
    }
    // Fev/2025 a abr/2026: o LapTime apagou as corridas (tempos e posições), mas as reservas pagas ficaram. Cada bateria
    // reservada entre o fim do CalXPro e a primeira corrida guardada entra só com quem andou (sem posição nem tempo).
    for (const k of Object.keys(indice)) if (k.startsWith('lr-')) delete indice[k];
    const primeiraCorrida = corridas.reduce((a, x) => Math.min(a, x.inicio.getTime()), Date.now());
    const fimCalxpro = Object.values(indice).reduce((a, b) => (b.id.startsWith('cx-') ? Math.max(a, b.inicio) : a), 0);
    const reservas = await query<{ id: string; nome: string; inicio: Date; tracado: string | null; cid: number; piloto: string; categoria: string | null }>(
      `SELECT b.Id_Booking id, b.Name nome, b.ExpectedDateTime inicio, t.Name tracado, c.Id cid, c.Nome piloto, cat.Name categoria
         FROM LapTimeMirror.dbo.Booking b JOIN LapTimeMirror.dbo.BookingCustomer bc ON bc.Id_Booking = b.Id_Booking
         JOIN dbo.Cliente c ON c.LegadoId = bc.Id_Customer
         LEFT JOIN LapTimeMirror.dbo.RacingTrack t ON t.Id_RacingTrack = b.Id_RacingTrack
         LEFT JOIN LapTimeMirror.dbo.Category cat ON cat.Id_Category = bc.Id_Category
        WHERE bc.IsCanceled = 0 AND bc.PaidOut = 1 AND b.ExpectedDateTime > @de AND b.ExpectedDateTime < @ate`,
      { de: new Date(fimCalxpro + 86_400_000), ate: new Date(Math.min(primeiraCorrida, Date.now())) },
    );
    for (const x of reservas) {
      const id = 'lr-' + x.id, inicio = x.inicio.getTime();
      const b = indice[id] ?? (indice[id] = { id, nome: String(x.nome ?? 'Bateria').trim(), tipo: 'treino', dia: diaSp(inicio), inicio, fim: inicio, chuva: false, trackId: null, tracado: comCategoria(tracadoBase(String(x.tracado ?? SEM_TRACADO)), x.categoria), pilotos: [], reserva: true });
      if (!b.pilotos.some((p) => p.cid === String(x.cid))) b.pilotos.push({ cid: String(x.cid), nome: String(x.piloto ?? '').trim(), kart: '', pos: 0, voltas: 0, melhor: null, cat: null, dq: false });
    }
    const ranks = await query<{ tipo: string; periodo: string; inicio: Date; tracado: string; categoria: string; pos: number; faixa: string | null; cid: number | null; nome: string; melhor: Date | null }>(
      `SELECT r.Id_RankingType tipo, r.Period periodo, r.StartDateTime inicio, t.Name tracado, cat.Name categoria, r.Pos pos, r.RangeWeight faixa, c.Id cid, r.Name nome, r.BestLapTime melhor
         FROM LapTimeMirror.dbo.Ranking r JOIN LapTimeMirror.dbo.RacingTrack t ON t.Id_RacingTrack = r.Id_RacingTrack
         LEFT JOIN LapTimeMirror.dbo.Category cat ON cat.Id_Category = r.Id_Category
         LEFT JOIN LapTimeMirror.dbo.Customer cu ON cu.UniqueId = r.CustomerUid LEFT JOIN dbo.Cliente c ON c.LegadoId = cu.Id_Customer
        WHERE r.Id_RankingType IN (2, 3) AND r.BestLapTime IS NOT NULL`,
    );
    rankAntigo = ranks.map((x) => ({ tipo: String(x.tipo) === '2' ? 'semana' as const : 'mes' as const, periodo: String(x.periodo ?? ''), dia: diaSp(x.inicio.getTime()), tracado: tracadoBase(String(x.tracado ?? '')), categoria: String(x.categoria ?? ''), pos: x.pos, faixa: x.faixa ?? null, cid: x.cid ? String(x.cid) : null, nome: String(x.nome ?? '').trim(), ms: msDe(x.melhor) ?? 0 })).filter((x) => x.ms > 0);
    const tmp = ARQ_LEGADO + '.tmp'; writeFileSync(tmp, JSON.stringify({ versao: 6, rankings: rankAntigo })); renameSync(tmp, ARQ_LEGADO);
    legadoCarregado = true;
    log?.(`pilotos: LapTime antigo lido (${corridas.length} participações em corridas, ${reservas.length} em reservas sem tempo, ${rankAntigo.length} posições de ranking)`);
  } catch (e) { log?.(`pilotos: LapTime antigo indisponível (${(e as Error).message})`); legadoCarregado = true; }
}
// ---------------------------------------------------------------- CalXPro (sistema anterior ao LapTime, banco CALXPRO do SRVKART, só leitura)
// Corridas de 2023 a jan/2025 com posição, voltas e melhor volta de cada piloto. O CalXPro não guardava o cliente da
// recepção na corrida, só nome e e-mail: o piloto é ligado ao cadastro unificado pelo e-mail (só quando o e-mail é de
// um cliente só). Lido uma vez (os dados não mudam mais) e guardado no índice com o prefixo "cx-".
let calxproCarregado = Object.keys(indice).some((k) => k.startsWith('cx-'));
async function carregarCalxpro(log?: (m: string) => void) {
  try {
    const linhas = await query<{ id: string; nome: string; inicio: Date; piloto: string; sobrenome: string | null; kart: number | null; pos: number | null; voltas: number | null; melhor: number | null; cid: number | null }>(
      `WITH em AS (SELECT LOWER(LTRIM(RTRIM(Email))) e, MIN(Id) cid FROM dbo.Cliente
                    WHERE Email LIKE '%@%' AND ResponsavelId IS NULL GROUP BY LOWER(LTRIM(RTRIM(Email))) HAVING COUNT(*) = 1)
       SELECT h.ID_CORRIDA id, h.ST_NOME nome, h.DT_DATA_HORA inicio, cc.ST_NOME piloto, cc.ST_SOBRENOME sobrenome, cc.NM_NUMERO kart,
              cc.NM_POSICAO pos, cc.TOT_VOLTAS voltas,
              CASE WHEN cc.TEMPO_MELHOR_VOLTA IS NULL THEN NULL ELSE DATEDIFF(ms, CAST(CAST(cc.TEMPO_MELHOR_VOLTA AS date) AS datetime2), cc.TEMPO_MELHOR_VOLTA) END melhor,
              em.cid cid
         FROM CALXPRO.dbo.HIST_CORRIDA h JOIN CALXPRO.dbo.HIST_COMPETIDOR_CORRIDA cc ON cc.ID_CORRIDA = h.ID_CORRIDA
         LEFT JOIN em ON em.e = LOWER(LTRIM(RTRIM(cc.ST_EMAIL)))
        WHERE h.DT_DATA_HORA IS NOT NULL AND cc.ST_NOME IS NOT NULL`,
    );
    for (const k of Object.keys(indice)) if (k.startsWith('cx-')) delete indice[k];
    let n = 0;
    for (const x of linhas) {
      const nomeBat = String(x.nome ?? '');
      // nome da corrida em linhas: "BATERIAS dd/mm…", "BATERIA 18:15", "TRAÇADO 1", "CORRIDA" | "TOMADA DE TEMPO"
      const num = /TRA.{1,2}ADO\s*(\d+)/i.exec(nomeBat)?.[1];
      const tracado = tracadoBase(num ? `Traçado ${num}${/INVERT/i.test(nomeBat) ? ' Invertido' : ''}` : 'Traçado principal');
      const tipo = /CORRIDA\s*$/i.test(nomeBat.trim()) ? 'corrida' : /TOMADA|CLASSIF|QUALI/i.test(nomeBat) ? 'classificacao' : 'treino';
      const inicio = x.inicio.getTime() + 3 * 3_600_000; // DT_DATA_HORA é hora de Betim gravada sem fuso
      const id = 'cx-' + x.id;
      const titulo = /BATERIA\s+\d{1,2}:\d{2}/i.exec(nomeBat)?.[0] ?? 'Bateria';
      const b = indice[id] ?? (indice[id] = { id, nome: titulo.replace(/^BATERIA/i, 'Bateria'), tipo, dia: diaSp(inicio), inicio, fim: inicio, chuva: chuvaNoNome(nomeBat), trackId: null, tracado, pilotos: [] });
      const nome = String(x.piloto).trim(), sob = String(x.sobrenome ?? '').trim();
      const completo = sob && !nome.toUpperCase().includes(sob.toUpperCase()) ? `${nome} ${sob}` : nome;
      if (semNome(completo, String(x.kart ?? ''))) continue;
      b.pilotos.push({ cid: x.cid ? String(x.cid) : null, nome: completo, kart: String(x.kart ?? ''), pos: x.pos || 0, voltas: x.voltas || 0, melhor: x.melhor && x.melhor > 0 ? x.melhor : null, cat: null, dq: false });
      n++;
    }
    calxproCarregado = true;
    log?.(`pilotos: CalXPro lido (${n} participações em corridas de 2023 a 2025)`);
    return true;
  } catch (e) { log?.(`pilotos: CalXPro indisponível (${(e as Error).message})`); calxproCarregado = true; return false; }
}

/** Primeiro dia com corrida detalhada (LapTime ou cronometragem nova): antes disso, só o ranking antigo do LapTime. */
const inicioDetalhado = () => Object.values(indice).reduce((a, b) => (!a || b.dia < a ? b.dia : a), '' as string) || '9999-12-31';

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
function ranking(tracado: string, per: Periodo): LinhaRank[] {
  const melhor = new Map<string, LinhaRank>();
  const por = (cid: string | null, nome: string) => (cid ? 'c' + cid : 'n' + nome.toLowerCase());
  for (const b of Object.values(indice)) {
    if (b.chuva) continue;
    if (per.de && b.dia < per.de) continue;
    if (per.ate && b.dia > per.ate) continue;
    for (const p of b.pilotos) {
      if (tk(b, p) !== tracado || !p.melhor || p.dq || !valeNoRanking(tracado, p.melhor)) continue;
      const k = por(p.cid, p.nome), at = melhor.get(k);
      if (at && at.ms <= p.melhor) continue;
      melhor.set(k, { pos: 0, cid: p.cid, nome: p.nome, ms: p.melhor, kart: p.kart, bateria: b.nome, dia: b.dia, sessaoId: b.id.startsWith('lt-') ? null : b.id, categoria: nomeCategoria(p.cat), antigo: b.id.startsWith('lt-') });
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
function tracadosComTempos(per: Periodo) {
  const conta = new Map<string, Set<string>>();
  const add = (t: string, k: string) => { const s = conta.get(t) ?? new Set<string>(); s.add(k); conta.set(t, s); };
  for (const b of Object.values(indice)) {
    if (b.chuva || (per.de && b.dia < per.de) || (per.ate && b.dia > per.ate)) continue;
    for (const p of b.pilotos) if (p.melhor && !p.dq && valeNoRanking(tk(b, p), p.melhor)) add(tk(b, p), p.cid ? 'c' + p.cid : 'n' + chaveNome(p.nome));
  }
  for (const x of antigosDo(null, per)) if (valeNoRanking(x.tracado, x.ms)) add(x.tracado, x.cid ? 'c' + x.cid : 'n' + chaveNome(x.nome));
  return [...conta.entries()].map(([nome, s]) => ({ nome, pilotos: s.size, superKart: /super kart/i.test(nome) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}

// ---------------------------------------------------------------- cartela
const COLS_LISTA = `c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento, c.Peso peso, c.Telefone telefone, c.Email email,
  c.Instagram instagram, c.Documento documento, c.ResponsavelId responsavelId, r.Nome responsavelNome, c.Bloqueado bloqueado, c.Origem origem,
  CONVERT(varchar(10), c.CriadoEm, 126) criadoEm, CASE WHEN f.ClienteId IS NULL THEN 0 ELSE 1 END temFoto`;
const DE_LISTA = `FROM dbo.Cliente c LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId LEFT JOIN dbo.ClienteFoto f ON f.ClienteId = c.Id`;
const INCOMPLETO = `(c.ResponsavelId IS NULL AND (c.DocumentoNum IS NULL OR c.Peso IS NULL OR c.TelefoneNum IS NULL OR c.Email IS NULL))`;
const POR_PAGINA = 50;

async function hojeNaPista() {
  return query<{ id: number; hora: string }>(
    `SELECT i.ClienteId id, MIN(CONVERT(varchar(5), b.Inicio, 108)) hora FROM dbo.Inscricao i JOIN dbo.Bateria b ON b.Id = i.BateriaId
      WHERE i.Status <> 'cancelada' AND CONVERT(date, b.Inicio) = CONVERT(date, SYSDATETIME()) GROUP BY i.ClienteId`,
  );
}
async function porIds(ids: number[]) {
  if (!ids.length) return [];
  const p = Object.fromEntries(ids.map((id, i) => ['i' + i, id]));
  const rows = await query<Record<string, unknown>>(`SELECT ${COLS_LISTA} ${DE_LISTA} WHERE c.Id IN (${ids.map((_, i) => '@i' + i).join(',')})`, p);
  const ordem = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (ordem.get(a.id as number) ?? 0) - (ordem.get(b.id as number) ?? 0));
}
/** Possível cadastro duplicado: mesmo CPF, ou mesmo nome com o mesmo telefone ou a mesma data de nascimento. */
async function duplicadosDe(ids: number[]) {
  if (!ids.length) return new Map<number, { id: number; nome: string }>();
  const p = Object.fromEntries(ids.map((id, i) => ['i' + i, id]));
  const rows = await query<{ id: number; outro: number; nome: string }>(
    `SELECT c.Id id, MIN(o.Id) outro, MIN(o.Nome) nome FROM dbo.Cliente c JOIN dbo.Cliente o ON o.Id <> c.Id AND (
        (c.DocumentoNum IS NOT NULL AND LEN(c.DocumentoNum) >= 11 AND o.DocumentoNum = c.DocumentoNum)
        OR (o.Nome = c.Nome AND ((c.TelefoneNum IS NOT NULL AND o.TelefoneNum = c.TelefoneNum) OR (c.Nascimento IS NOT NULL AND o.Nascimento = c.Nascimento))))
      WHERE c.Id IN (${ids.map((_, i) => '@i' + i).join(',')}) AND NOT (o.ResponsavelId = c.Id OR c.ResponsavelId = o.Id) GROUP BY c.Id`,
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

export async function pilotosRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  let m: RegExpMatchArray | null;

  if (path === '/pilotos/resumo' && method === 'GET') {
    await indiceFresco();
    const [base] = await query<Record<string, number>>(
      `SELECT COUNT(*) total, SUM(CASE WHEN LegadoId IS NOT NULL THEN 1 ELSE 0 END) legado,
              SUM(CASE WHEN CriadoEm >= DATEADD(day, -7, SYSDATETIME()) AND Origem <> 'laptime' THEN 1 ELSE 0 END) novos,
              SUM(CASE WHEN ResponsavelId IS NULL AND (DocumentoNum IS NULL OR Peso IS NULL OR TelefoneNum IS NULL OR Email IS NULL) THEN 1 ELSE 0 END) incompletos,
              SUM(CASE WHEN MONTH(Nascimento) = MONTH(SYSDATETIME()) THEN 1 ELSE 0 END) aniversariantes
         FROM dbo.Cliente`,
    );
    const lim = somaDias(hojeSp(), -30), ativos = new Set<string>();
    for (const b of Object.values(indice)) if (b.dia >= lim) for (const p of b.pilotos) if (p.cid) ativos.add(p.cid);
    const novosOrigem = await query<{ origem: string; n: number }>(`SELECT Origem origem, COUNT(*) n FROM dbo.Cliente WHERE CriadoEm >= DATEADD(day, -7, SYSDATETIME()) AND Origem <> 'laptime' GROUP BY Origem`);
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
    const car = carreiras();
    // ordem: recentes (padrão) | nome | baterias | melhor (as duas últimas só nas listas que vêm da carreira)
    const ordem = ['nome', 'baterias', 'melhor'].includes(url.searchParams.get('ordem') ?? '') ? url.searchParams.get('ordem')! : 'recentes';
    let rows: Record<string, unknown>[] = [], total = 0;
    if (q.length >= 2) {
      const d = onlyDigits(q);
      const where = q.includes('@') ? 'c.Email LIKE @q' : d.length >= 4 && d.length === q.replace(/[\s.\-()/]/g, '').length ? '(c.DocumentoNum LIKE @d OR c.TelefoneNum LIKE @t)' : 'c.Nome COLLATE Latin1_General_CI_AI LIKE @n';
      rows = await query(`SELECT TOP 100 ${COLS_LISTA} ${DE_LISTA} WHERE ${where} ORDER BY c.Nome`, { q: q.toLowerCase() + '%', d: d + '%', t: '%' + d, n: '%' + q.replace(/\s+/g, '%') + '%' });
      total = rows.length;
    } else if (filtro === 'hoje' || filtro === 'ativos') {
      let ids: number[];
      if (filtro === 'hoje') ids = hojeLista.sort((a, b) => a.hora.localeCompare(b.hora)).map((h) => h.id);
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
      const where = filtro === 'novos' ? `c.CriadoEm >= DATEADD(day, -7, SYSDATETIME()) AND c.Origem <> 'laptime'`
        : filtro === 'incompletos' ? INCOMPLETO
          : filtro === 'aniversariantes' ? 'MONTH(c.Nascimento) = MONTH(SYSDATETIME())' : '1 = 1';
      const ordemSql = ordem === 'nome' ? 'c.Nome, c.Id' : filtro === 'aniversariantes' ? 'DAY(c.Nascimento), c.Nome' : 'c.AtualizadoEm DESC, c.Id DESC';
      total = (await one<{ n: number }>(`SELECT COUNT(*) n FROM dbo.Cliente c WHERE ${where}`))?.n ?? 0;
      rows = await query(`SELECT ${COLS_LISTA} ${DE_LISTA} WHERE ${where} ORDER BY ${ordemSql} OFFSET @ini ROWS FETCH NEXT ${porPag} ROWS ONLY`, { ini });
    }
    send(200, { total, pagina, porPagina: porPag, ordem, linhas: await completar(rows, hoje, car), atualizadoEm });
    return true;
  }

  if ((m = path.match(/^\/pilotos\/(\d+)$/)) && method === 'GET') {
    await indiceFresco();
    const id = Number(m[1]);
    const c = await one<Record<string, unknown>>(`SELECT ${CLIENTE_COLS}, r.Nome responsavelNome, c.LegadoId legadoId, CASE WHEN f.ClienteId IS NULL THEN 0 ELSE 1 END temFoto
      FROM dbo.Cliente c LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId LEFT JOIN dbo.ClienteFoto f ON f.ClienteId = c.Id WHERE c.Id = @id`, { id });
    if (!c) throw new HttpError(404, 'Cliente não encontrado.');
    const cid = String(id);
    const corridas = Object.values(indice).flatMap((b) => b.pilotos.filter((p) => p.cid === cid).map((p) => ({ sessaoId: b.id, dia: b.dia, inicio: b.inicio, bateria: b.nome, tipo: b.tipo, tracado: tk(b, p), chuva: b.chuva, pos: p.pos, de: b.pilotos.length, voltas: p.voltas, melhor: p.melhor, kart: p.kart, dq: p.dq })))
      .sort((a, b) => b.inicio - a.inicio);
    const sem = periodo('semana'), mes = periodo('mes');
    const porTracado = new Map<string, { ms: number; dia: string; bateria: string }>();
    for (const x of corridas) if (!x.chuva && !x.dq && x.melhor && valeNoRanking(x.tracado, x.melhor)) { const at = porTracado.get(x.tracado); if (!at || x.melhor < at.ms) porTracado.set(x.tracado, { ms: x.melhor, dia: x.dia, bateria: x.bateria }); }
    const meusAntigos = rankAntigo.filter((x) => x.cid === cid);
    for (const x of meusAntigos) { if (!valeNoRanking(x.tracado, x.ms)) continue; const at = porTracado.get(x.tracado); if (!at || x.ms < at.ms) porTracado.set(x.tracado, { ms: x.ms, dia: x.dia, bateria: 'ranking do LapTime' }); }
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
    const dependentes = await query(`SELECT Id id, Nome nome, CONVERT(varchar(10), Nascimento, 126) nascimento FROM dbo.Cliente WHERE ResponsavelId = @id ORDER BY Nome`, { id });
    const financeiro = await one(`SELECT COUNT(*) vendas, ISNULL(SUM(FinalCentavos), 0) total, CONVERT(varchar(16), MAX(CriadoEm), 126) ultima FROM dbo.Venda WHERE ClienteId = @id AND Cancelada = 0`, { id });
    const hoje = (await hojeNaPista()).find((h) => h.id === id)?.hora ?? null;
    const resumo = carreiras().get(cid) ?? null;
    const duplicado = (await duplicadosDe([id])).get(id) ?? null;
    const validos = meusAntigos.filter((y) => valeNoRanking(y.tracado, y.ms));
    const laptimeResumo = validos.length ? { meses: porMes.size, melhorPos: Math.min(...validos.map((y) => y.pos)), vitorias: new Set(validos.filter((y) => y.pos === 1).map((y) => y.tipo + y.periodo + y.tracado)).size } : null;
    send(200, { cliente: c, hoje, resumo, tracados, principal, evolucao, laptime, semanasTop, laptimeResumo, duplicado, corridas: corridas.slice(0, 200), totalCorridas: corridas.length, dependentes, financeiro, desde: Object.values(indice).reduce((a, b) => (!a || b.dia < a ? b.dia : a), '' as string) || null });
    return true;
  }

  if ((m = path.match(/^\/pilotos\/(\d+)\/foto$/))) {
    const id = Number(m[1]);
    if (method === 'GET') {
      const f = await one<{ Foto: Buffer; Miniatura: Buffer; Tipo: string }>(`SELECT Foto, Miniatura, Tipo FROM dbo.ClienteFoto WHERE ClienteId = @id`, { id });
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
      if (!(await one(`SELECT 1 x FROM dbo.Cliente WHERE Id = @id`, { id }))) throw new HttpError(404, 'Cliente não encontrado.');
      await query(
        `MERGE dbo.ClienteFoto AS t USING (SELECT @id ClienteId) AS s ON t.ClienteId = s.ClienteId
         WHEN MATCHED THEN UPDATE SET Foto = @foto, Miniatura = @mini, Tipo = @tipo, AtualizadoPor = @uid, AtualizadoEm = SYSDATETIME()
         WHEN NOT MATCHED THEN INSERT (ClienteId, Foto, Miniatura, Tipo, AtualizadoPor) VALUES (@id, @foto, @mini, @tipo, @uid);`,
        { id, foto: foto.buf, mini: mini.buf, tipo: foto.tipo, uid: req.sessao.uid },
      );
      send(200, { ok: true });
      return true;
    }
    if (method === 'DELETE') { await query(`DELETE FROM dbo.ClienteFoto WHERE ClienteId = @id`, { id }); send(200, { ok: true }); return true; }
  }

  if (path === '/pilotos/miniaturas' && method === 'GET') {
    const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
    if (!ids.length) { send(200, {}); return true; }
    const p = Object.fromEntries(ids.map((id, i) => ['i' + i, id]));
    const rows = await query<{ id: number; Miniatura: Buffer; Tipo: string }>(`SELECT ClienteId id, Miniatura, Tipo FROM dbo.ClienteFoto WHERE ClienteId IN (${ids.map((_, i) => '@i' + i).join(',')})`, p);
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
      `SELECT c.Id id, CONVERT(varchar(10), c.Nascimento, 126) nascimento, c.Sexo sexo, CASE WHEN f.ClienteId IS NULL THEN 0 ELSE 1 END temFoto FROM dbo.Cliente c LEFT JOIN dbo.ClienteFoto f ON f.ClienteId = c.Id WHERE c.Id IN (${ids.map((_, i) => '@i' + i).join(',')})`,
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
export async function rankingPublicoParaApp() {
  await indiceFresco();
  const TOP = 100;
  const per = { semana: periodo('semana'), mes: periodo('mes'), geral: periodo('geral') };
  const pos = new Map<string, Record<string, Record<string, { pos: number; de: number }>>>(); // cid → período → traçado → posição
  const nomes = new Map<string, string>();
  const periodos: Record<string, { de: string | null; ate: string | null; tracados: { nome: string; pilotos: number; linhas: unknown[] }[] }> = {};
  for (const [nome, p] of Object.entries(per)) {
    const tracados = tracadosComTempos(p).sort((a, b) => b.pilotos - a.pilotos);
    periodos[nome] = {
      de: p.de, ate: p.ate,
      tracados: tracados.map((t) => {
        const todas = ranking(t.nome, p);
        for (const l of todas) if (l.cid) {
          if (!nomes.has(l.cid)) nomes.set(l.cid, l.nome);
          const porPer = pos.get(l.cid) ?? {}; (porPer[nome] ??= {})[t.nome] = { pos: l.pos, de: todas.length }; pos.set(l.cid, porPer);
        }
        return { nome: t.nome, pilotos: todas.length, linhas: todas.slice(0, TOP).map((l) => ({ pos: l.pos, id: l.cid, nome: l.nome, ms: l.ms, kart: l.kart || null, dia: l.dia, categoria: l.categoria })) };
      }),
    };
  }

  const car = carreiras();
  const corridasPor = new Map<string, { dia: string; inicio: number; bateria: string; tipo: string; tracado: string; pos: number; de: number; melhor: number | null; kart: string; dq: boolean; chuva: boolean; voltaMaisRapida: boolean; reserva: boolean }[]>();
  for (const b of Object.values(indice)) {
    const validos = b.pilotos.filter((p) => p.melhor && !p.dq);
    const maisRapida = validos.length ? Math.min(...validos.map((p) => p.melhor!)) : null;
    for (const p of b.pilotos) {
      if (!p.cid) continue;
      nomes.set(p.cid, p.nome);
      const l = corridasPor.get(p.cid) ?? [];
      l.push({ dia: b.dia, inicio: b.inicio, bateria: b.nome, tipo: b.tipo, tracado: tk(b, p), pos: p.pos, de: b.pilotos.length, melhor: p.melhor, kart: p.kart, dq: p.dq, chuva: b.chuva, voltaMaisRapida: !!p.melhor && p.melhor === maisRapida && validos.length > 1, reserva: !!b.reserva });
      corridasPor.set(p.cid, l);
    }
  }
  const pilotos: Record<string, unknown> = {};
  const antigoPor = new Map<string, RankAntigo[]>();
  for (const x of rankAntigo) if (x.cid) { const l = antigoPor.get(x.cid) ?? []; l.push(x); antigoPor.set(x.cid, l); }
  // inclui quem só aparece no ranking (LapTime antigo, sem corrida no índice novo)
  for (const cid of new Set([...corridasPor.keys(), ...pos.keys()])) {
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
    const minhas = pos.get(cid) ?? {};
    // LapTime antigo (antes de 02/09/2026) só guardou os top 10 semanais/mensais: quantas semanas o piloto entrou nesse top
    const antigas = antigoPor.get(cid) ?? [];
    const semanasTop10 = new Set(antigas.filter((x) => x.tipo === 'semana').map((x) => x.periodo)).size;
    const mesesTop10 = new Set(antigas.filter((x) => x.tipo === 'mes').map((x) => x.periodo)).size;
    const primeiraAntiga = antigas.reduce((a, x) => (!a || x.dia < a ? x.dia : a), '' as string) || null;
    pilotos[cid] = {
      semanasTop10, mesesTop10,
      nome: nomes.get(cid) ?? '',
      baterias: r?.baterias ?? corridas.length,
      corridas: corridasValidas.length,
      voltas: r?.voltas ?? 0,
      vitorias: r?.vitorias ?? 0,
      podios: r?.podios ?? 0,
      poles: corridas.filter((c) => c.tipo !== 'corrida' && !c.dq && c.pos === 1).length,
      voltasMaisRapidas: corridas.filter((c) => c.voltaMaisRapida && !c.dq).length,
      primeira: [r?.primeira, primeiraAntiga].filter(Boolean).sort()[0] ?? null,
      ultima: r?.ultima ?? null,
      tracados: [...melhorPorTracado.entries()].map(([nome, t]) => ({
        nome, ms: t.ms, dia: t.dia, corridas: corridas.filter((c) => c.tracado === nome).length,
        semana: minhas.semana?.[nome] ?? null, mes: minhas.mes?.[nome] ?? null, geral: minhas.geral?.[nome] ?? null,
      })).sort((a, b) => b.corridas - a.corridas || a.ms - b.ms),
      // só reserva (sem posição nem tempo) não aparece em "últimas baterias": o app mostraria "0º"
      recentes: corridas.filter((c) => !c.reserva).slice(0, 15).map((c) => ({ dia: c.dia, bateria: c.bateria, tipo: c.tipo, tracado: c.tracado, pos: c.pos, de: c.de, melhor: c.melhor, kart: c.kart })),
    };
  }
  // histórico de XP por mês (últimos 12), na mesma conta do app: bateria 50, pódio +50, vitória +100, pole +50, volta mais rápida +50
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
    const horaSp = (ms: number) => Number(new Date(ms).toLocaleString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
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
  }
  // comparativo de XP (mesma conta do app): líder geral e quem está logo acima e logo abaixo de cada piloto
  type P = { nome: string; baterias: number; podios: number; vitorias: number; poles: number; voltasMaisRapidas: number };
  const porXp = Object.entries(pilotos as Record<string, P>)
    .filter(([, p]) => p.baterias > 0)
    .map(([id, p]) => ({ id, nome: p.nome, xp: p.baterias * 50 + p.podios * 50 + p.vitorias * 100 + p.poles * 50 + p.voltasMaisRapidas * 50 }))
    .sort((a, b) => b.xp - a.xp);
  porXp.forEach((x, i) => {
    (pilotos[x.id] as Record<string, unknown>).comparativo = { pos: i + 1, de: porXp.length, lider: i ? porXp[0] : null, acima: i ? porXp[i - 1] : null, abaixo: porXp[i + 1] ?? null, acimaLista: porXp.slice(Math.max(0, i - 10), i).reverse() };
  });
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
  return { ranking: { periodos, kartsDoDia }, pilotos };
}
