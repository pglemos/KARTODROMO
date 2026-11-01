import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Processo separado: publica o índice já produzido pelo servidor, sem reiniciar a operação.
const base = process.cwd();
process.loadEnvFile(resolve(base, '.env.local'));
const recentes = new Map();
let ultimaRevisao = 0;
async function publicar() {
const origem = JSON.parse(readFileSync(resolve(base, '.runtime/pilotos-cronometragem.json'), 'utf8')).baterias ?? {};
const timing = async (path) => {
  const r = await fetch(new URL(path, process.env.OPS_TIMING_URL || 'http://192.168.20.249:4050'), { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Cronometragem: HTTP ' + r.status);
  return r.json();
};
const sessoes = (await timing('/api/sessions')).filter(s => s.state === 'encerrada' && s.type !== 'equalizacao');
const ultimas = new Set(sessoes.slice().sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, 3).map(s => s.id));
const revisarTudo = Date.now() - ultimaRevisao >= 60000;
const revisar = sessoes.filter(s => {
  const anterior = recentes.get(s.id) ?? origem[s.id];
  return revisarTudo || !anterior || anterior.fim !== s.finishedAt || ultimas.has(s.id);
});
for (let i = 0; i < revisar.length; i += 3) await Promise.all(revisar.slice(i, i + 3).map(async s => {
  const d = await timing('/api/sessions/' + encodeURIComponent(s.id));
  const inicio = d.startedAt ?? d.createdAt;
  const pilotos = (d.standings ?? []).flatMap(r => {
    const c = (d.competitors ?? []).find(c => c.kart === r.kart && c.name === r.name);
    return !c || c.autoAdded || !r.name?.trim() || r.name.toLowerCase() === ('kart ' + r.kart).toLowerCase() ? [] : [{ cid: c.customerId, nome: r.name, kart: r.kart, pos: r.position, voltas: r.laps, melhor: r.bestLapMs, cat: c.category, dq: !!r.desclassificado }];
  });
  recentes.set(s.id, { id: s.id, nome: d.name, tipo: d.type, dia: new Date(inicio).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }), inicio, fim: d.finishedAt, chuva: d.chuva === true || /chuva/i.test(d.track?.name ?? ''), tracado: d.track?.name ?? '', pilotos });
}));
if (revisarTudo) ultimaRevisao = Date.now();
const vivos = new Set(sessoes.map(s => s.id));
for (const id of Object.keys(origem)) if (!/^(lt|lr|cx)-/.test(id) && !vivos.has(id)) delete origem[id];
for (const [id, b] of recentes) if (vivos.has(id)) origem[id] = b; else recentes.delete(id);
const arquivo = resolve(base, '.runtime/karts-app-publicados.json');
const enviados = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {};
const grupos = new Map();
const tempos = new Map();
const baterias = Object.values(origem).filter((b) => !/^(lt|lr|cx)-/.test(b.id) && !b.chuva && b.tipo !== 'equalizacao' && !b.reserva);
const tracadoDe = (b) => String(b.tracado ?? '').replace(/\s*·\s*Super Kart\s*$/i, '').replace(/\s+normal$/i, '').trim();
const categoriaDe = (p) => /^\d{1,3}$/.test(String(p.kart ?? '').trim()) && Number(p.kart) <= 199 ? Number(p.kart) <= 99 ? 'Indoor' : 'Super Kart' : null;
const chaveTempo = (b, p) => tracadoDe(b) + '|' + categoriaDe(p, b);
for (const b of baterias) for (const p of b.pilotos) if (!p.dq && Number.isFinite(p.melhor) && p.melhor > 0) {
  const chave = chaveTempo(b, p), lista = tempos.get(chave) ?? [];
  lista.push(p.melhor); tempos.set(chave, lista);
}
for (const lista of tempos.values()) lista.sort((a, b) => a - b);
for (const b of baterias) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dia)) continue;
  const linhas = grupos.get(b.dia) ?? [];
  for (const p of b.pilotos) {
    if (!categoriaDe(p) || p.dq) continue;
    const amostra = tempos.get(chaveTempo(b, p)) ?? [];
    const limite = (amostra[Math.floor(amostra.length / 2)] ?? 0) * 0.75;
    const tracado = tracadoDe(b);
    const ms = Number.isFinite(p.melhor) && p.melhor > 0 && p.melhor >= limite && tracado && !tracado.startsWith('Traçado principal') ? p.melhor : null;
    linhas.push({ id: p.cid ? String(p.cid) : null, kart: String(p.kart), dia: b.dia, inicio: b.inicio, pos: p.pos, piloto: p.nome, ms, bateria: b.nome, de: b.pilotos.length, tracado, categoria: categoriaDe(p, b) });
  }
  grupos.set(b.dia, linhas);
}
const destino = new URL('/api/mobile/v1/internal/ranking', process.env.MOBILE_IDENTITY_LINK_URL);
let total = 0;
for (const [dia, linhas] of grupos) {
  const dados = { linhas }, chave = 'karts:' + dia;
  const hash = createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  if (enviados[chave] === hash) continue;
  const r = await fetch(destino, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN }, body: JSON.stringify({ itens: [{ chave, dados }] }), signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!r.ok) throw new Error('Publicação de karts: HTTP ' + r.status);
  enviados[chave] = hash; total++;
}
const vinculosResponse = await fetch(new URL(process.env.MOBILE_IDENTITY_LINK_URL), {
  headers: { 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN },
  signal: AbortSignal.timeout(15000),
  redirect: 'error',
});
if (!vinculosResponse.ok) throw new Error('Consulta de contas vinculadas: HTTP ' + vinculosResponse.status);
const vinculos = await vinculosResponse.json();
const clientesVinculados = new Set((Array.isArray(vinculos.customerIds) ? vinculos.customerIds : [])
  .map(String).filter(id => /^\d{1,20}$/.test(id)));
const historicos = new Map([...clientesVinculados].map(id => [id, new Map()]));
for (const [key, bateria] of Object.entries(origem)) {
  const sessionId = String(bateria.id ?? key);
  const eventName = String(bateria.nome ?? '').replace(/\s+/g, ' ').trim();
  const eventDate = String(bateria.dia ?? '');
  const tipo = String(bateria.tipo ?? '').toLowerCase();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId) || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      !eventName || eventName.length > 160 || /equalizacao|teste codex/i.test(eventName + ' ' + tipo) ||
      /^test(?:-|_)/i.test(sessionId) || tipo.includes('equalizacao') || bateria.reserva === true || !Array.isArray(bateria.pilotos)) continue;
  for (const piloto of bateria.pilotos) {
    const customerId = String(piloto.cid ?? '');
    const history = historicos.get(customerId);
    if (!history || piloto.dq === true) continue;
    const displayName = String(piloto.nome ?? '').replace(/\s+/g, ' ').trim();
    const kart = String(piloto.kart ?? '').trim();
    const position = Number(piloto.pos);
    const laps = Number(piloto.voltas ?? 0);
    const bestLapMs = Number.isSafeInteger(piloto.melhor) && piloto.melhor > 0 && piloto.melhor <= 600000 ? piloto.melhor : null;
    if (!displayName || displayName.length > 80 || !kart || kart.length > 40 || !Number.isSafeInteger(position) || position < 1 || position > 1000 ||
        !Number.isSafeInteger(laps) || laps < 0 || laps > 10000) continue;
    history.set(sessionId, { sessionId, eventName, eventDate, displayName, position, kart, laps, bestLapMs });
  }
}
const itensHistoricos = [];
for (const [customerId, porSessao] of historicos) {
  const results = [...porSessao.values()].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.sessionId.localeCompare(a.sessionId));
  if (!results.length) continue;
  const chave = 'historico:' + customerId, dados = { results };
  const hash = createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  if (enviados[chave] !== hash) itensHistoricos.push({ chave, dados, hash });
}
let historicosPublicados = 0;
for (let i = 0; i < itensHistoricos.length; i += 10) {
  const lote = itensHistoricos.slice(i, i + 10);
  const r = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN },
    body: JSON.stringify({ itens: lote.map(({ chave, dados }) => ({ chave, dados })) }),
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
  });
  if (!r.ok) throw new Error('Publicação de histórico: HTTP ' + r.status);
  for (const item of lote) enviados[item.chave] = item.hash;
  historicosPublicados += lote.length;
}
writeFileSync(arquivo + '.tmp', JSON.stringify(enviados)); renameSync(arquivo + '.tmp', arquivo);
console.log(JSON.stringify({ diasPublicados: total, diasDisponiveis: grupos.size, historicosPublicados }));
}
do {
  try { await publicar(); } catch (error) { console.error('ranking-sync', error.message); if (!process.argv.includes('--watch')) process.exitCode = 1; }
  if (process.argv.includes('--watch')) await new Promise(resolve => setTimeout(resolve, 15000));
} while (process.argv.includes('--watch'));
