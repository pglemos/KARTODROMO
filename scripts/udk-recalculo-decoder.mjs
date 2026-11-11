#!/usr/bin/env node
// Recalcula tomada (melhor volta) e corrida (voltas + ordem de chegada) só com as passagens brutas do decoder.
// Uso: node scripts/udk-recalculo-decoder.mjs <diario.jsonl> <sessoes.json>
import { readFileSync } from 'node:fs';

const [arq, arqSes] = process.argv.slice(2);
const S = JSON.parse(readFileSync(arqSes, 'utf8'));
const P = readFileSync(arq, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((x) => x.raw).sort((a, b) => a.seq - b.seq);
const T = (h) => Date.parse(`2026-11-10T${h}-03:00`);
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
const hh = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });

// trocas de kart registradas: kart antigo também pertence ao piloto
const swaps = readFileSync(arq, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((x) => x.type === 'kart-swap');
function nomeDoKart(sessId, kart) {
  const c = S[sessId].comp.find((x) => String(x.kart) === String(kart));
  if (c) return c.name;
  const sw = swaps.find((x) => String(x.fromKart) === String(kart) || String(x.toKart) === String(kart));
  return sw ? `${sw.name}` : `kart ${kart}`;
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*-\s*I$/, '').toLowerCase().trim();

function tomada(sessId, ini, fim) {
  const ps = P.filter((p) => p.wallMs >= ini && p.wallMs <= fim);
  const ult = new Map(), best = new Map(), voltas = new Map();
  for (const p of ps) {
    const nome = nomeDoKart(sessId, p.kart);
    const a = ult.get(p.transponder);
    if (a != null) {
      const d = p.decoderTimeMs - a;
      if (d > 40000 && d < 120000) {
        voltas.set(nome, (voltas.get(nome) || 0) + 1);
        if (!best.has(nome) || d < best.get(nome).ms) best.set(nome, { ms: d, kart: p.kart });
      }
    }
    ult.set(p.transponder, p.decoderTimeMs);
  }
  const todos = new Set(ps.map((p) => nomeDoKart(sessId, p.kart)));
  const sem = [...todos].filter((n) => !best.has(n));
  return [...[...best.entries()].sort((a, b) => a[1].ms - b[1].ms).map(([n, v]) => ({ nome: n, ms: v.ms, kart: v.kart, voltas: voltas.get(n) })), ...sem.map((n) => ({ nome: n, ms: null }))];
}

function corrida(sessId, green, chk, ateMs) {
  // passagens depois da verde; a 1ª é a largada; chegada = 1ª passagem após a quadriculada
  const ps = P.filter((p) => p.wallMs > green && p.wallMs <= ateMs);
  const k = new Map();
  for (const p of ps) {
    const nome = nomeDoKart(sessId, p.kart);
    const r = k.get(nome) || { nome, cruz: [], fim: null, kart: p.kart };
    if (r.fim) continue;
    r.cruz.push(p);
    if (p.wallMs >= chk) r.fim = p;
    k.set(nome, r);
  }
  const out = [...k.values()].map((r) => {
    const ultimo = r.cruz.at(-1);
    let best = null;
    for (let i = 1; i < r.cruz.length; i++) {
      const d = r.cruz[i].decoderTimeMs - r.cruz[i - 1].decoderTimeMs;
      if (d > 40000 && d < 120000 && (best == null || d < best)) best = d;
    }
    return { nome: r.nome, kart: r.kart, voltas: r.cruz.length - 1, ultimo: ultimo.decoderTimeMs, chegou: !!r.fim, best, largada: hh(r.cruz[0].wallMs) };
  });
  out.sort((a, b) => b.voltas - a.voltas || a.ultimo - b.ultimo);
  return out;
}

const sistema = (id) => S[id].standingsPos || null;

const cfg = [
  ['SUPER POLE I', 'tomada', '2026-11-10-c8b1b82b', T('21:26:36'), T('21:32:16')],
  ['SESSÃO 21:34 (tomada lançada como corrida)', 'tomada', '2026-11-10-ac790575', T('21:34:00'), T('21:38:30')],
  ['CORRIDA I', 'corrida', '2026-11-10-ac790575', T('21:51:03'), T('22:10:51'), T('22:15:00')],
  ['SUPER POLE II', 'tomada', '2026-11-10-645bef63', T('22:27:39'), T('22:36:14')],
  ['CORRIDA II', 'corrida', '2026-11-10-d792d3fa', T('22:36:20'), T('22:58:38'), T('23:05:00')],
];
const res = {};
for (const [titulo, tipo, id, a, b, c] of cfg) {
  const r = tipo === 'tomada' ? tomada(id, a, b) : corrida(id, a, b, c);
  res[titulo] = r;
  console.log(`\n=== ${titulo} (decoder bruto) ===`);
  r.forEach((x, i) =>
    console.log(
      tipo === 'tomada'
        ? `${String(i + 1).padStart(2)} ${x.nome.padEnd(34)} ${x.ms ? fmt(x.ms) : 'sem volta'} ${x.voltas ? `(${x.voltas}v)` : ''}`
        : `${String(i + 1).padStart(2)} ${x.nome.padEnd(34)} k${String(x.kart).padEnd(4)} ${x.voltas}v  chegada ${hh(x.ultimo + (P[0].wallMs - P[0].decoderTimeMs))} ${x.chegou ? '' : '(sem passagem pós-quadriculada)'} mv ${x.best ? fmt(x.best) : '-'} larg ${x.largada}`,
    ),
  );
}
process.stdout.write('\n__JSON__' + JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.map((x) => ({ nome: norm(x.nome), n: x.nome, ms: x.ms ?? x.best, voltas: x.voltas }))]))));
