// Mede quanto o ranking do app trava o event loop (rodar no SRVKART: node --cpu-prof --import tsx scripts/ops/perfil-ranking.ts).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) for (const l of readFileSync(envPath, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] ||= m[2].replace(/^["']|["']$/g, ''); }
let ultimo = Date.now(), pior = 0;
const t0 = setInterval(() => { const n = Date.now(); pior = Math.max(pior, n - ultimo - 20); ultimo = n; }, 20);
const fase = async <T>(nome: string, f: () => Promise<T> | T): Promise<T> => { pior = 0; const i = Date.now(); const r = await f(); console.log(`${nome}: ${Date.now() - i} ms, maior trava de loop ${pior} ms`); return r; };
const { rankingPublicoParaApp } = await import('../../lib/ops/pilotos');
const r1 = await fase('rankingPublicoParaApp (1ª, reconstrói)', () => rankingPublicoParaApp());
await fase('rankingPublicoParaApp (2ª, cache)', () => rankingPublicoParaApp());
const hashDe = (t: string) => createHash('sha1').update(t).digest('base64');
await fase('hash ranking', () => hashDe(JSON.stringify(r1.ranking)));
await fase('hash posicoes', () => { for (const d of Object.values(r1.posicoes)) hashDe(JSON.stringify(d)); });
await fase('hash fichas', async () => { let n = 0; for (const d of Object.values(r1.pilotos as Record<string, unknown>)) { hashDe(JSON.stringify(d)); if ((++n & 511) === 511) await new Promise<void>((r) => setImmediate(r)); } });
console.log('pilotos', Object.keys(r1.pilotos as object).length, 'posicoes', Object.keys(r1.posicoes).length, 'heapMB', Math.round(process.memoryUsage().heapUsed / 1e6));
clearInterval(t0); process.exit(0);
