import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMobileLive, retratoParaApp } from '../../workers/pre-cadastro/src/mobile/live';

// Ao vivo do app: repassa o retrato da crono só com os campos da tela.
const retrato = {
  status: 'live', updatedAt: '2026-10-20T20:01:00.000Z', sessionType: 'race', eventName: 'BATERIA 17:00 · CORRIDA',
  trackName: 'Kartodromo Internacional de Betim', race: { startedAt: '2026-10-20T20:00:00.000Z', id: 'x', rules: {} },
  drivers: [
    { position: 1, kart: '48', name: 'Jorge Antonio', time: '1:15.418', laps: 16, last: '1:17.683', bestLap: 15, gap: '' },
    { position: 2, kart: '44', name: 'Iury Pedroso', time: '1:16.471', laps: 16, last: '1:16.900', bestLap: 9, gap: '+2.350', cpf: '000' },
    { position: 999, kart: '-', name: '-', time: '-' },
  ],
};

describe('ao vivo do app', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mantém só os campos da tela e tira a linha vazia do painel', () => {
    const r = retratoParaApp(retrato);
    expect(r).toMatchObject({ status: 'live', eventName: 'BATERIA 17:00 · CORRIDA', startedAt: '2026-10-20T20:00:00.000Z', sessionType: 'race' });
    expect(r.drivers).toHaveLength(2);
    expect(r.drivers[1]).toEqual({ position: 2, kart: '44', name: 'Iury Pedroso', best: '1:16.471', laps: 16, last: '1:16.900', bestLap: 9, gap: '+2.350' });
    expect(JSON.stringify(r)).not.toContain('cpf');
  });

  it('sem bateria: lista vazia', () => {
    expect(retratoParaApp({ status: 'empty', drivers: [] }).drivers).toEqual([]);
  });

  it('busca na crono e responde 503 quando ela não responde', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(retrato), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const ok = await handleMobileLive(new Request('https://reservas.kartodromodebetim.com.br/api/mobile/v1/live'), {});
    expect(ok.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toBe('https://crono.kartodromodebetim.com.br/api/livetime-snapshot');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const fora = await handleMobileLive(new Request('https://reservas.kartodromodebetim.com.br/api/mobile/v1/live'), {});
    expect(fora.status).toBe(503);
  });
});
