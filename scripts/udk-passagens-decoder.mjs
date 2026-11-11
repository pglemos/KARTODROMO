#!/usr/bin/env node
// Relatório de TODAS as passagens brutas do decoder (diário data/timing/passagens/<dia>.jsonl),
// a partir de um horário, em HTML pronto para imprimir em PDF.
// Uso: node scripts/udk-passagens-decoder.mjs <diario.jsonl> <sessoes.json> <saida.html> [inicio ISO]
import { readFileSync, writeFileSync } from 'node:fs';

const [arq, arqSessoes, saida, inicioIso = '2026-11-10T21:00:00-03:00'] = process.argv.slice(2);
const t0 = Date.parse(inicioIso);
const sessoes = JSON.parse(readFileSync(arqSessoes, 'utf8'));
const linhas = readFileSync(arq, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((x) => x.wallMs >= t0);

const passagens = linhas.filter((x) => x.raw).sort((a, b) => a.seq - b.seq);
const eventos = linhas.filter((x) => !x.raw);

// relógio de parede local (servidor) e relógio do decoder
const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }) + '.' + String(ms % 1000).padStart(3, '0');
const horaDec = (ms) => new Date(ms).toISOString().slice(11, 23);
const volta = (ms) => (ms == null ? '' : ms >= 600000 ? `${Math.floor(ms / 60000)}m${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s` : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// sessões ordenadas por verde, para nomear e achar a mais próxima
const lista = Object.entries(sessoes).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.green || 0) - (b.green || 0));
const nomeSessao = (id) => sessoes[id]?.name || (id ? id : '—');
// piloto do kart na sessão (lista oficial de competidores daquela sessão)
const pilotoDe = (sessionId, kart, wallMs) => {
  let s = sessoes[sessionId];
  if (!s) s = [...lista].reverse().find((x) => x.green && x.green <= wallMs) || lista[0];
  const c = s?.comp?.find((x) => String(x.kart) === String(kart));
  return c ? c.name : '';
};

// tempo desde a passagem anterior do MESMO transponder (relógio do decoder, sem filtro nenhum)
const ultimo = new Map();
for (const p of passagens) {
  const ant = ultimo.get(p.transponder);
  p.delta = ant != null ? p.decoderTimeMs - ant : null;
  ultimo.set(p.transponder, p.decoderTimeMs);
  p.piloto = pilotoDe(p.sessionId, p.kart, p.wallMs);
}

const seqs = passagens.map((p) => p.seq);
const saltos = [];
for (let i = 1; i < seqs.length; i++) if (seqs[i] - seqs[i - 1] !== 1) saltos.push(`${seqs[i - 1]} → ${seqs[i]}`);
const offsetMin = passagens.length ? Math.round((passagens[0].wallMs - passagens[0].decoderTimeMs) / 60000) : 0;

// janelas de atividade: separa por pausa > 90 s sem passagem
const blocos = [];
for (const p of passagens) {
  const b = blocos.at(-1);
  if (!b || p.wallMs - b.fim > 90000) blocos.push({ ini: p.wallMs, fim: p.wallMs, n: 1, karts: new Set([p.kart]), sess: new Set([p.sessionId || p.result]) });
  else { b.fim = p.wallMs; b.n++; b.karts.add(p.kart); b.sess.add(p.sessionId || p.result); }
}

// por kart
const porKart = new Map();
for (const p of passagens) {
  const k = `${p.kart ?? '?'}|${p.transponder}`;
  if (!porKart.has(k)) porKart.set(k, []);
  porKart.get(k).push(p);
}

const linhaTab = (p) => `<tr class="${p.result !== 'counted' ? 'x' : ''}"><td>${p.seq}</td><td>${hora(p.wallMs)}</td><td>${horaDec(p.decoderTimeMs)}</td><td>${p.transponder}</td><td><b>${esc(p.kart)}</b></td><td class=l>${esc(p.piloto)}</td><td>${volta(p.delta)}</td><td class=l>${esc(nomeSessao(p.sessionId))}</td><td>${esc(p.result)}</td></tr>`;

const html = `<!doctype html><meta charset=utf-8><title>Passagens do decoder — 10/11/2026</title><style>
@page{size:A4;margin:10mm}body{font:9px/1.35 -apple-system,Segoe UI,sans-serif;color:#111}
h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #d0142c;padding-bottom:2px;break-after:avoid}
.sub{color:#555;font-size:10px;margin-bottom:8px}table{border-collapse:collapse;width:100%}th{background:#111;color:#fff;font-size:8.5px;padding:3px 4px;text-align:center}
td{padding:2px 4px;border-bottom:1px solid #ddd;text-align:center;font-variant-numeric:tabular-nums}.l{text-align:left}tr.x td{color:#a00}
.box{border:1px solid #ccc;padding:6px 8px;margin:6px 0;background:#fafafa;font-size:10px}.k{break-inside:avoid;margin-bottom:8px}thead{display:table-header-group}
</style>
<h1>Passagens brutas do decoder — 10/11/2026 a partir de ${hora(t0).slice(0, 5)}</h1>
<div class=sub>Kartódromo Internacional de Betim · Fonte: diário bruto do servidor de cronometragem (cada mensagem P3 recebida do decoder, gravada na chegada, antes de qualquer bateria). Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</div>
<div class=box>
<b>Total de passagens:</b> ${passagens.length} (seq. do decoder ${seqs[0]} a ${seqs.at(-1)}) · <b>Saltos na sequência:</b> ${saltos.length ? saltos.join(', ') : 'nenhum — o servidor recebeu todas as passagens que o decoder emitiu no período'}<br>
<b>Relógio do decoder</b> difere do relógio do servidor em ${offsetMin} min (coluna "Hora decoder" é o relógio interno do decoder, usado para o tempo de volta; "Hora local" é a chegada no servidor, horário de Brasília).<br>
<b>Tempo de volta</b> = diferença entre passagens consecutivas do MESMO transponder pelo relógio do decoder, sem filtro, sem bateria e sem correção manual. Linhas em vermelho: passagem que o sistema não contou em bateria (resultado ≠ counted).<br>
<b>Piloto</b>: pela lista de competidores da bateria em que a passagem caiu (ou a bateria mais recente).
</div>
<h2>1. Linha do tempo (janelas de atividade na pista)</h2>
<table><thead><tr><th>Início</th><th>Fim</th><th>Duração</th><th>Passagens</th><th>Karts</th><th class=l>Bateria(s) no sistema</th></tr></thead>${blocos
  .map((b) => `<tr><td>${hora(b.ini).slice(0, 8)}</td><td>${hora(b.fim).slice(0, 8)}</td><td>${volta(b.fim - b.ini)}</td><td>${b.n}</td><td>${b.karts.size}</td><td class=l>${[...b.sess].map((s) => esc(nomeSessao(s))).join(' · ')}</td></tr>`)
  .join('')}</table>
<h2>2. Baterias no sistema</h2>
<table><thead><tr><th class=l>Bateria</th><th>Bandeira verde</th><th>Bandeira quadriculada</th><th>Passagens contadas</th></tr></thead>${lista
  .map((s) => `<tr><td class=l>${esc(s.name)}</td><td>${s.green ? hora(s.green).slice(0, 8) : '—'}</td><td>${s.chk ? hora(s.chk).slice(0, 8) : '—'}</td><td>${passagens.filter((p) => p.sessionId === s.id && p.result === 'counted').length}</td></tr>`)
  .join('')}</table>
${eventos.length ? `<h2>3. Eventos manuais registrados (trocas de kart)</h2><table><thead><tr><th>Hora</th><th class=l>Evento</th><th class=l>Bateria</th></tr></thead>${eventos
  .map((e) => `<tr><td>${hora(e.wallMs)}</td><td class=l>${esc(e.type)}: ${esc(e.name)} kart ${esc(e.fromKart)} → ${esc(e.toKart)} (${esc(e.source)})</td><td class=l>${esc(nomeSessao(e.sessionId))}</td></tr>`)
  .join('')}</table>` : ''}
<h2>4. Todas as passagens em ordem (sequência do decoder)</h2>
<table><thead><tr><th>Seq. decoder</th><th>Hora local</th><th>Hora decoder</th><th>Transponder</th><th>Kart</th><th class=l>Piloto</th><th>Volta</th><th class=l>Bateria no sistema</th><th>Resultado</th></tr></thead>${passagens.map(linhaTab).join('')}</table>
<h2 style="break-before:page">5. Passagens por kart</h2>
${[...porKart.entries()]
  .sort((a, b) => Number(a[0].split('|')[0]) - Number(b[0].split('|')[0]))
  .map(([k, ps]) => {
    const [kart, tr] = k.split('|');
    const voltas = ps.map((p) => p.delta).filter((d) => d != null && d > 40000 && d < 120000);
    const melhor = voltas.length ? Math.min(...voltas) : null;
    return `<div class=k><b>Kart ${esc(kart)}</b> · transponder ${tr} · ${ps.length} passagens · pilotos: ${esc([...new Set(ps.map((p) => p.piloto).filter(Boolean))].join(', '))}${melhor ? ` · menor intervalo entre 40 s e 2 min: <b>${volta(melhor)}</b>` : ''}
<table><thead><tr><th>Seq.</th><th>Hora local</th><th>Hora decoder</th><th>Volta</th><th class=l>Piloto</th><th class=l>Bateria no sistema</th><th>Resultado</th></tr></thead>${ps
      .map((p) => `<tr class="${p.result !== 'counted' ? 'x' : ''}"><td>${p.seq}</td><td>${hora(p.wallMs)}</td><td>${horaDec(p.decoderTimeMs)}</td><td>${volta(p.delta)}</td><td class=l>${esc(p.piloto)}</td><td class=l>${esc(nomeSessao(p.sessionId))}</td><td>${esc(p.result)}</td></tr>`)
      .join('')}</table></div>`;
  })
  .join('')}
<h2>6. Mensagem bruta P3 de cada passagem (hex, como saiu do decoder)</h2>
<table><thead><tr><th>Seq.</th><th>Hora local</th><th class=l>Mensagem P3 (hex)</th></tr></thead>${passagens.map((p) => `<tr><td>${p.seq}</td><td>${hora(p.wallMs)}</td><td class=l style="font-family:monospace;font-size:7px;word-break:break-all">${p.raw}</td></tr>`).join('')}</table>`;
writeFileSync(saida, html);
console.log(JSON.stringify({ passagens: passagens.length, saltos: saltos.length, blocos: blocos.map((b) => `${hora(b.ini).slice(0, 8)}-${hora(b.fim).slice(0, 8)} n=${b.n} karts=${b.karts.size} ${[...b.sess].map(nomeSessao).join('/')}`) }, null, 1));
