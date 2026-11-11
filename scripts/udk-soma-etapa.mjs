#!/usr/bin/env node
// Soma das 2 corridas de uma etapa regular do Campeonato Ultras do Kart (UDK), separada por categoria.
// Lê as sessões direto do servidor de cronometragem (CRONOMETRAGEM, localhost:4050) via `ssh orbits`.
//
// Regras (Regulamento 2ª Temporada 2026):
//   Art. 18  pontos por bateria pela posição GERAL da corrida (categorias juntas):
//            1º 50 · 2º 45 · 3º 42 · 4º 40 · 5º 38 · depois 1 a menos (… 30º 13)
//   Art. 19  +1 pole da Super Pole (de cada bateria) · +1 melhor volta da corrida
//   Art. 22  bandeira preta e branca: -10 · 2ª advertência: desclassificação + -15 · bandeira preta: desclassificação + -20
//
// Uso:
//   node scripts/udk-soma-etapa.mjs --pole1 <id> --c1 <id> --pole2 <id> --c2 <id> [--etapa "4ª ETAPA"] [--data 10/11/2026]
//   node scripts/udk-soma-etapa.mjs --hoje        (acha as sessões "ULTRAS DO KART I/II" do dia)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);

// ---------- categorias (mesmos pilotos da 3ª etapa; ajuste aqui) ----------
const INSANOS = [
  'André Felisberto', 'Lucas Rabelo', 'Matteo Rinoldi|Matteo Rinold', 'Vitor Hugo', 'Agenor Jr.|Agenor Junior',
  'Rafael Soares', 'Marcelo Augusto', 'Bernardo Thadeu', 'Renato Oliveira', 'Alexandre Janotti|Alexandre Konovaloff Jannotti',
  'Gegela', 'Pablo Fonseca', 'Saulo Vieira', 'Pedro Horta', 'Anderson Silveira', 'Rodrigo Salvador',
];
const RAPIDOS = [
  'Bernardo Ferreira Duarte|Bernardo Ferreira Duarte Santos', 'Maxmiiler Frantiscoly', 'Arthur|Arthur Ferreira',
  'Wesley Cardoso|Wesley Almeida Cardoso', 'Guilherme Faria', 'Marcos Felipe', 'Bráulio Bonoto',
  'Fernando Godoy|Fernando Marciel Godoy', 'Raphael Werner|Fael Werner', 'Pedro Guilherme|Pedro Guilherme Lemos Teixeira',
  'Lucas Gabriel Voieta Parreira', 'Marcelo Marques|Marcelo Henrique Aguiar Marques', 'Lucas Godoy', 'Rafael Teodoro',
  'Lucca Dambrós', 'Gabriel Nogueira|Gabriel Nogueira Fernandes',
];
// pilotos novos: preencher após confirmação da Comissão Organizadora (Art. 5º)
const EXTRA = JSON.parse(process.env.UDK_CATEGORIAS_EXTRA || '{}'); // {"Rodrigo Salvador":"INSANOS", ...}

const norm = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s*-\s*I+$/i, '') // "Rafael Soares - I"
    .replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const catIndex = new Map();
const display = new Map();
for (const [cat, list] of [['INSANOS', INSANOS], ['RAPIDOS', RAPIDOS]]) {
  for (const entry of list) {
    const names = entry.split('|');
    for (const n of names) { catIndex.set(norm(n), cat); display.set(norm(n), names[0]); }
  }
}
for (const [n, cat] of Object.entries(EXTRA)) { catIndex.set(norm(n), cat); display.set(norm(n), n); }

const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const who = (name) => {
  const k = norm(name);
  return { key: display.has(k) ? norm(display.get(k)) : k, cat: catIndex.get(k) || null, nome: display.get(k) || titleCase(String(name).replace(/\s*-\s*I+$/i, '').replace(/\s+/g, ' ').trim()) };
};

// ---------- leitura via ssh ----------
function ps(script) {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', 'orbits', 'powershell -NoProfile -Command -'], {
    input: `[Console]::OutputEncoding=[Text.Encoding]::UTF8\n${script}\n`,
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}
const lastJson = (out) => JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).pop());

function listarHoje() {
  const out = ps(`(Invoke-WebRequest -UseBasicParsing http://localhost:4050/api/sessions).Content`);
  return lastJson(out);
}
function sessao(id) {
  const out = ps(`(Invoke-WebRequest -UseBasicParsing http://localhost:4050/api/sessions/${id}).Content`);
  return lastJson(out);
}

let ids = { pole1: args.pole1, c1: args.c1, pole2: args.pole2, c2: args.c2 };
if (args.hoje) {
  const dia = new Date().toISOString().slice(0, 10);
  const todas = listarHoje().filter((s) => String(s.id).startsWith(dia) && /ultras do kart/i.test(s.name));
  const acha = (re) => todas.find((s) => re.test(s.name))?.id;
  ids = {
    pole1: ids.pole1 || acha(/ultras do kart i\b(?!i).*super pole/i),
    c1: ids.c1 || acha(/ultras do kart i\b(?!i).*corrida/i),
    pole2: ids.pole2 || acha(/ultras do kart ii\b.*super pole/i),
    c2: ids.c2 || acha(/ultras do kart ii\b.*corrida/i),
  };
}
for (const k of ['c1', 'c2']) if (!ids[k]) { console.error(`Falta sessão ${k}.`); process.exit(1); }

// ---------- pontuação ----------
const pontosPos = (p) => (p === 1 ? 50 : p === 2 ? 45 : p === 3 ? 42 : p === 4 ? 40 : p >= 5 && p <= 30 ? 43 - p : 0);

function corrida(cId, poleId, rotulo) {
  const s = sessao(cId);
  const st = (s.standings || []).filter((x) => x.position);
  const avisos = [];
  if (s.state !== 'encerrada') avisos.push(`${rotulo}: sessão "${s.name}" está "${s.state}" (prévia parcial)`);
  let pole = null;
  if (poleId) {
    const sp = sessao(poleId);
    // pole = menor melhor volta da Super Pole; só vale se a maioria dos pilotos marcou volta
    const comVolta = (sp.standings || []).filter((x) => x.bestLapMs);
    if (comVolta.length >= Math.max(3, st.length / 2)) {
      const p1 = comVolta.reduce((a, b) => (b.bestLapMs < a.bestLapMs ? b : a));
      pole = who(p1.name).key;
    } else {
      avisos.push(`${rotulo}: Super Pole "${sp.name}" com só ${comVolta.length} volta(s) registrada(s) — pole NÃO atribuída, conferir com a Direção de Prova`);
    }
    if (sp.state !== 'encerrada') avisos.push(`${rotulo}: Super Pole "${sp.name}" está "${sp.state}"`);
  }
  const voltas = st.filter((x) => x.bestLapMs && !x.desclassificado);
  const mvMs = Math.min(...voltas.map((x) => x.bestLapMs));
  const res = new Map();
  for (const x of st) {
    const p = who(x.name);
    const adv = Number(x.advertencias || 0);
    let pts = x.desclassificado ? 0 : pontosPos(x.position);
    const tags = [];
    if (pole === p.key) { pts += 1; tags.push('pole'); }
    if (!x.desclassificado && x.bestLapMs === mvMs) { pts += 1; tags.push('MV'); }
    if (x.desclassificado) { pts -= adv >= 2 ? 15 : 20; tags.push(adv >= 2 ? 'DSQ -15' : 'DSQ -20'); }
    else if (adv >= 1) { pts -= 10; tags.push('-10'); }
    res.set(p.key, { ...p, pos: x.position, pts, tags });
  }
  return { res, avisos, nome: s.name };
}

const R1 = corrida(ids.c1, ids.pole1, 'C1');
const R2 = corrida(ids.c2, ids.pole2, 'C2');

const pilotos = new Map();
for (const [i, R] of [[1, R1], [2, R2]]) {
  for (const r of R.res.values()) {
    const p = pilotos.get(r.key) || { nome: r.nome, cat: r.cat, c: {} };
    p.c[i] = r;
    pilotos.set(r.key, p);
  }
}
const linhas = [...pilotos.values()].map((p) => {
  const a = p.c[1]?.pts ?? 0, b = p.c[2]?.pts ?? 0;
  return { ...p, total: a + b, melhor: Math.max(a, b), pior: Math.min(a, b), c1: a };
});
const ordena = (x, y) => y.total - x.total || y.melhor - x.melhor || y.pior - x.pior || y.c1 - x.c1;
const ins = linhas.filter((l) => l.cat === 'INSANOS').sort(ordena);
const rap = linhas.filter((l) => l.cat === 'RAPIDOS').sort(ordena);
const sem = linhas.filter((l) => !l.cat).sort(ordena);

// ---------- saída texto ----------
const fmtC = (r) => (r ? `${r.pts}${r.tags.length ? ` (${r.tags.join(' ')})` : ''}` : '—');
const tabela = (t, l) => {
  console.log(`\n== ${t} ==`);
  l.forEach((x, i) => console.log(`${String(i + 1).padStart(2)}  ${x.nome.padEnd(34)} C1 ${fmtC(x.c[1]).padEnd(14)} C2 ${fmtC(x.c[2]).padEnd(14)} TOTAL ${x.total}`));
};
[...R1.avisos, ...R2.avisos].forEach((a) => console.log(`⚠ ${a}`));
tabela('ULTRA INSANOS', ins);
tabela('ULTRAS RÁPIDOS', rap);
if (sem.length) tabela('SEM CATEGORIA (definir em UDK_CATEGORIAS_EXTRA)', sem);

// ---------- saída HTML (layout da arte da 3ª etapa) ----------
const etapa = args.etapa || '4ª ETAPA';
const data = args.data || new Date().toLocaleDateString('pt-BR');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cel = (r) => (r ? `${r.pts}${r.tags.length ? `<small>${esc(r.tags.join(' '))}</small>` : ''}` : '—');
const bloco = (t, l) => `<section><h2>${t}</h2><table><tr><th>POS</th><th class=l>PILOTO</th><th>C1</th><th>C2</th><th>TOTAL</th></tr>${l
  .map((x, i) => `<tr><td>${i < 3 ? `<b class=pd>${i + 1}</b>` : i + 1}</td><td class=l>${esc(x.nome)}</td><td>${cel(x.c[1])}</td><td>${cel(x.c[2])}</td><td class=t>${x.total}</td></tr>`)
  .join('')}</table></section>`;
const html = `<!doctype html><meta charset=utf-8><title>UDK ${esc(etapa)}</title><style>
body{margin:0;background:#0b0b0b;color:#fff;font-family:system-ui,Segoe UI,sans-serif}.w{width:1900px;padding:70px;box-sizing:border-box}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:8px solid #d0142c;padding-bottom:40px}
.logo{font:italic 900 130px/1 system-ui;letter-spacing:-4px}h1{font:italic 900 56px system-ui;margin:0;text-align:right}
.sub{color:#bbb;font-size:30px;letter-spacing:2px;text-align:right}main{display:flex;gap:46px;margin-top:50px}section{flex:1}
h2{font:italic 900 44px system-ui;border-left:14px solid #d0142c;padding-left:20px}table{width:100%;border-collapse:collapse;font-size:31px}
th{color:#d0142c;font-size:24px;letter-spacing:3px;padding:14px 8px;border-bottom:3px solid #333}td{text-align:center;padding:22px 8px;border-bottom:1px solid #2a2a2a;font-weight:600}
.l{text-align:left}.t{font-weight:900;font-size:36px}small{display:block;color:#d0142c;font-size:19px;font-weight:800}
.pd{background:#d0142c;border-radius:8px;padding:4px 16px}footer{color:#999;font-size:23px;line-height:1.6;margin-top:50px;border-top:2px solid #333;padding-top:30px}
</style><div class=w><header><div class=logo>UDK</div><div><h1>${esc(etapa)} — SOMA DAS 2 CORRIDAS</h1><div class=sub>CAMPEONATO ULTRAS DO KART 2026 · ${esc(data)}</div></div></header>
<main>${bloco('ULTRA INSANOS', ins)}${bloco('ULTRAS RÁPIDOS', rap)}</main>${sem.length ? `<main>${bloco('SEM CATEGORIA', sem)}</main>` : ''}
<footer>${[...R1.avisos, ...R2.avisos].map((a) => `<b style="color:#d0142c">⚠ ${esc(a)}</b><br>`).join('')}Pontos por bateria (Art. 18), pela posição GERAL da corrida: 1º 50 · 2º 45 · 3º 42 · 4º 40 · 5º 38 · depois 1 a menos.<br>
pole = +1 pole da Super Pole · MV = +1 melhor volta (Art. 19) · -10 = bandeira preta e branca (+5 s e -10 pontos, Art. 22).<br>
Empates: o regulamento não define desempate (caso omisso, Art. 27); ordem pelo melhor resultado, depois o 2º melhor, depois a Corrida 1. Prévia — Resultado Oficial em até 3 dias (Art. 23).</footer></div>`;
const dir = join(process.cwd(), 'output', 'udk');
mkdirSync(dir, { recursive: true });
const file = join(dir, `udk-${etapa.replace(/\W+/g, '-').toLowerCase()}-soma.html`);
writeFileSync(file, html);
console.log(`\nHTML: ${file}`);
console.log(`Sessões: ${JSON.stringify(ids)}`);
