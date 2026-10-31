import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('revalida traçado corrigido em bateria antiga mesmo sem mudança de finishedAt', async () => {
  const now = Date.now();
  const posts: { itens: { chave: string; dados: { linhas?: unknown[]; results?: unknown[] } }[] }[] = [];
  const server = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url === '/api/mobile/v1/internal/identity-links') return void res.end('{"customerIds":["123"]}');
    if (req.url === '/api/sessions') return void res.end(JSON.stringify(['test-codex','recent-1','recent-2','recent-3'].map((id, i) => ({ id, state: 'encerrada', type: 'corrida', finishedAt: now + i }))));
    if (req.url?.startsWith('/api/sessions/')) return void res.end(JSON.stringify({ id: req.url.split('/').pop(), name: 'TESTE CODEX', type: 'corrida', startedAt: now - 60000, finishedAt: now, track: { name: 'Traçado 11 Invertido Chicane' }, competitors: [{ kart: '100', name: 'TESTE CODEX', customerId: '123', category: 'cat-indoor' }], standings: [{ kart: '100', name: 'TESTE CODEX', position: 1, laps: 2, bestLapMs: 60000 }] }));
    let body = ''; for await (const chunk of req) body += chunk;
    posts.push(JSON.parse(body)); res.end('{"ok":true}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), 'ranking-codex-'));
  try {
    mkdirSync(join(dir, '.runtime'));
    writeFileSync(join(dir, '.runtime/pilotos-cronometragem.json'), JSON.stringify({ baterias: { 'test-codex': {
      id: 'test-codex', fim: now, dia: new Date(now).toLocaleDateString('sv-SE', {timeZone:'America/Sao_Paulo'}), tracado: 'Traçado 1', tipo: 'corrida', pilotos: [{ cid:'123', nome:'TESTE CODEX', kart:'100', melhor:60000 }],
    }, 'lt-2024-10-26': {
      id: 'lt-2024-10-26', nome: 'Corrida 1', fim: now - 2 * 365 * 24 * 60 * 60 * 1000, dia: '2024-10-26', inicio: now - 2 * 365 * 24 * 60 * 60 * 1000,
      tracado: 'Traçado 4', tipo: 'corrida', pilotos: [{ cid:'123', nome:'Ana Silva', kart:'14', pos:2, voltas:18, melhor:38652, dq:false }],
    } } }));
    writeFileSync(join(dir, '.env.local'), `OPS_TIMING_URL=http://127.0.0.1:${port}\nMOBILE_IDENTITY_LINK_URL=http://127.0.0.1:${port}/api/mobile/v1/internal/identity-links\nMOBILE_ADMIN_TOKEN=synthetic-test-token\n`);
    await promisify(execFile)(process.execPath, [resolve('scripts/ops/publicar-karts-app.mjs')], { cwd: dir, env: { PATH: process.env.PATH, NODE_ENV: 'test' } });
    const ranking = posts.flatMap(post => post.itens).find(item => item.chave.startsWith('karts:'));
    expect(ranking?.dados.linhas).toHaveLength(4);
    expect(ranking?.dados.linhas).toEqual(expect.arrayContaining([expect.objectContaining({ id: '123', kart: '100', categoria: 'Super Kart', tracado: 'Traçado 11 Invertido Chicane', ms: 60000 })]));
    expect(ranking?.dados.linhas?.every((l: unknown) => (l as {tracado:string}).tracado === 'Traçado 11 Invertido Chicane')).toBe(true);

    const historical = posts.flatMap(post => post.itens).find(item => item.chave === 'historico:123');
    expect(historical?.dados.results).toEqual([expect.objectContaining({
      sessionId: 'lt-2024-10-26', eventName: 'Corrida 1', eventDate: '2024-10-26', displayName: 'Ana Silva',
      position: 2, kart: '14', laps: 18, bestLapMs: 38652,
    })]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
