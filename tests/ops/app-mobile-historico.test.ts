import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ops/db', async () => {
  const real = await vi.importActual<typeof import('../../lib/ops/db')>('../../lib/ops/db');
  return { onlyDigits: real.onlyDigits, query: vi.fn(async () => []) };
});

const fsMock = vi.hoisted(() => ({ conteudo: '' }));
vi.mock('node:fs', async () => {
  const real = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...real,
    existsSync: (p: string) => String(p).endsWith('pilotos-cronometragem.json') ? true : real.existsSync(p),
    readFileSync: ((p: string, enc?: BufferEncoding) => String(p).endsWith('pilotos-cronometragem.json') ? fsMock.conteudo : real.readFileSync(p, enc)) as typeof real.readFileSync,
  };
});

const { historicoDoCliente, publicarHistoricosVinculados } = await import('../../lib/ops/app-mobile');

const baterias = {
  a: { id: 'b-2026-10-01-1', nome: 'BATERIA 19:00 · CORRIDA', dia: '2026-10-01', tipo: 'corrida', pilotos: [
    { cid: 42, nome: 'Maria', kart: '12', pos: 1, voltas: 20, melhor: 41_234 },
    { cid: 7, nome: 'João', kart: '3', pos: 2, voltas: 20, melhor: 41_900 },
  ] },
  b: { id: 'b-2026-11-02-1', nome: 'BATERIA 20:00 · CORRIDA', dia: '2026-11-02', tipo: 'corrida', pilotos: [
    { cid: '42', nome: 'Maria', kart: '8', pos: 3, voltas: 18, melhor: 0 },
  ] },
  dq: { id: 'b-2026-11-03-1', nome: 'BATERIA', dia: '2026-11-03', tipo: 'corrida', pilotos: [
    { cid: 42, nome: 'Maria', kart: '8', pos: 1, voltas: 18, melhor: 40_000, dq: true },
  ] },
  eq: { id: 'b-2026-11-04-1', nome: 'Equalização', dia: '2026-11-04', tipo: 'equalizacao', pilotos: [
    { cid: 42, nome: 'Maria', kart: '8', pos: 1, voltas: 5, melhor: 40_000 },
  ] },
};

describe('histórico completo do cliente para o app', () => {
  it('só as baterias do cliente, mais recentes primeiro, sem desclassificação nem equalização', () => {
    const h = historicoDoCliente(baterias, '42');
    expect(h.map((r) => r.sessionId)).toEqual(['b-2026-11-02-1', 'b-2026-10-01-1']);
    expect(h[0]).toMatchObject({ position: 3, kart: '8', bestLapMs: null });
    expect(h[1]).toMatchObject({ position: 1, laps: 20, bestLapMs: 41_234, displayName: 'Maria' });
  });

  it('cliente sem corrida: vazio', () => {
    expect(historicoDoCliente(baterias, '999')).toEqual([]);
  });

  it('reconciliação publica quem está vinculado e sem histórico; depois só o que mudou', async () => {
    process.env.MOBILE_IDENTITY_LINK_URL = 'https://reservas.kartodromodebetim.com.br/api/mobile/v1/internal/identity-links';
    process.env.MOBILE_ADMIN_TOKEN = 't';
    fsMock.conteudo = JSON.stringify({ baterias });
    const enviados: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL | string, init?: RequestInit) => {
      if (String(url).endsWith('/identity-links')) return new Response(JSON.stringify({ customerIds: ['42', '999'] }));
      enviados.push(...(JSON.parse(String(init?.body)).itens as { chave: string }[]).map((i) => i.chave));
      return new Response('{"ok":true}');
    }));
    expect(await publicarHistoricosVinculados(vi.fn(), 10_000_000)).toBe(1);
    expect(enviados).toEqual(['historico:42']);
    // 10 min depois, nada mudou: não regrava
    expect(await publicarHistoricosVinculados(vi.fn(), 10_000_000 + 600_000)).toBe(0);
    vi.unstubAllGlobals();
  });
});
