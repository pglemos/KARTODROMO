import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Processo separado: publica o índice já produzido pelo servidor, sem reiniciar a operação.
const base = process.cwd();
process.loadEnvFile(resolve(base, '.env.local'));
const origem = JSON.parse(readFileSync(resolve(base, '.runtime/pilotos-cronometragem.json'), 'utf8')).baterias ?? {};
const arquivo = resolve(base, '.runtime/karts-app-publicados.json');
const enviados = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {};
const grupos = new Map();
const tempos = new Map();
const baterias = Object.values(origem).filter((b) => !/^(lt|lr|cx)-/.test(b.id) && !b.chuva && b.tipo !== 'equalizacao' && !b.reserva);
const tracadoDe = (b) => String(b.tracado ?? '').replace(/\s*·\s*Super Kart\s*$/i, '').replace(/\s+normal$/i, '').trim();
const categoriaDe = (p, b) => /super\s*kart/i.test(p.cat ?? p.t ?? b.tracado ?? '') ? 'Super Kart' : /indoor/i.test(p.cat ?? '') ? 'Indoor' : null;
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
    if (!p.kart || p.dq) continue;
    const amostra = tempos.get(chaveTempo(b, p)) ?? [];
    const limite = (amostra[Math.floor(amostra.length / 2)] ?? 0) * 0.75;
    const tracado = tracadoDe(b);
    const ms = Number.isFinite(p.melhor) && p.melhor > 0 && p.melhor >= limite && tracado && !tracado.startsWith('Traçado principal') ? p.melhor : null;
    linhas.push({ kart: String(p.kart), dia: b.dia, inicio: b.inicio, pos: p.pos, piloto: p.nome, ms, bateria: b.nome, de: b.pilotos.length, tracado, categoria: categoriaDe(p, b) });
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
writeFileSync(arquivo + '.tmp', JSON.stringify(enviados)); renameSync(arquivo + '.tmp', arquivo);
console.log(JSON.stringify({ diasPublicados: total, diasDisponiveis: grupos.size }));
