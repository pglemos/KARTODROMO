import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

type Linha = { kart: string; piloto: string; ms: number | null; tracado: string; categoria: string | null };

// O publicador lê o índice que o servidor já produziu (.runtime/pilotos-cronometragem.json) e manda um item
// karts:<dia> por dia; não reenvia o que não mudou.
it('publica os karts do dia pelo índice local, sem importadas do LapTime e sem reenviar o que não mudou', async () => {
  const now = Date.now();
  const dia = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const posts: { itens: { chave: string; dados: { linhas: Linha[] } }[] }[] = [];
  const tokens: string[] = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    tokens.push(String(req.headers['x-mobile-admin-token']));
    posts.push(JSON.parse(body)); res.setHeader('content-type', 'application/json'); res.end('{"ok":true}');
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;
  const dir = mkdtempSync(join(tmpdir(), 'ranking-'));
  try {
    mkdirSync(join(dir, '.runtime'));
    writeFileSync(join(dir, '.runtime/pilotos-cronometragem.json'), JSON.stringify({ baterias: {
      b1: { id: 'b1', nome: 'Bateria 1', dia, inicio: now, tracado: 'Traçado 11 · Super Kart', tipo: 'corrida', pilotos: [
        { cid: '1', nome: 'Ana', kart: '100', pos: 1, melhor: 60000, cat: 'Super Kart' },
        { cid: '2', nome: 'Bia', kart: '101', pos: 2, melhor: 61000, cat: 'Super Kart' },
        { cid: '3', nome: 'Caio', kart: '102', pos: 3, melhor: 1000, cat: 'Super Kart' }, // volta cortada: sem tempo
        { cid: '4', nome: 'Davi', kart: '103', pos: 4, melhor: 62000, dq: true },
      ] },
      'lt-2024-10-26': { id: 'lt-2024-10-26', nome: 'Antiga', dia: '2024-10-26', tracado: 'Traçado 4', tipo: 'corrida', pilotos: [{ nome: 'X', kart: '14', melhor: 38652 }] },
    } }));
    writeFileSync(join(dir, '.env.local'), `MOBILE_IDENTITY_LINK_URL=http://127.0.0.1:${port}/api/mobile/v1/internal/identity-links\nMOBILE_ADMIN_TOKEN=synthetic-test-token\n`);
    const rodar = () => promisify(execFile)(process.execPath, [resolve('scripts/ops/publicar-karts-app.mjs')], { cwd: dir, env: { ...process.env, NODE_ENV: 'test' } });
    await rodar();

    const itens = posts.flatMap((p) => p.itens);
    expect(itens.map((i) => i.chave)).toEqual([`karts:${dia}`]);
    const linhas = itens[0].dados.linhas;
    expect(linhas.map((l) => l.kart)).toEqual(['100', '101', '102']);
    expect(linhas.every((l) => l.tracado === 'Traçado 11' && l.categoria === 'Super Kart')).toBe(true);
    expect(linhas.find((l) => l.kart === '102')?.ms).toBeNull();
    expect(tokens).toEqual(['synthetic-test-token']);
    expect(Object.keys(JSON.parse(readFileSync(join(dir, '.runtime/karts-app-publicados.json'), 'utf8')))).toEqual([`karts:${dia}`]);

    await rodar();
    expect(posts).toHaveLength(1);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
