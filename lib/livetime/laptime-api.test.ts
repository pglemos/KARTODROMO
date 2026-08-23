import { describe, expect, it, vi } from 'vitest';
import { fetchLapTimeApiSnapshot, formatLapTimeValue } from '@/lib/livetime/laptime-api';

describe('formatLapTimeValue', () => {
  it('formats LapTime SQL datetime values as timing cells', () => {
    expect(formatLapTimeValue('2026-05-22T00:01:06.618-03:00')).toBe('1:06.618');
    expect(formatLapTimeValue('2026-05-21T00:30:17.757796')).toBe('30:17.757');
    expect(formatLapTimeValue('2026-05-21T11:40:48.670')).toBe('11:40:48.670');
  });
});

describe('fetchLapTimeApiSnapshot', () => {
  it('maps current racing and competitor payloads to a LiveTiming snapshot', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/Racing/getByState/1')) {
        return Response.json({
          success: true,
          data: [],
        });
      }

      if (url.includes('/Racing/getByState/5')) {
        return Response.json({
          success: true,
          data: [
            {
              Id_Racing: 516034,
              RacingState: 5,
              Name: 'Tomada de Tempo',
              racingtype: { Name: 'Corrida' },
              racingtrack: { Name: 'Tracado 1' },
              racinggroup: { Name: 'BATERIA 21:40' },
              racingevent: { Name: 'Baterias 21/05/2026' },
            },
          ],
        });
      }

      return Response.json({
        success: true,
        data: [
          { Pos: 2, Number: '119', Competitor: 'Jonathan Lincoln', ShortName: 'JL1', LapTime: '2026-05-22T00:01:06.618-03:00' },
          { Pos: 1, Number: '121', ShortName: 'Vanderson', LapTime: '2026-05-22T00:01:05.100-03:00' },
        ],
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLapTimeApiSnapshot({
      baseUrl: 'http://192.168.20.254/laptime',
      token: 'token',
    });

    expect(snapshot.source).toBe('rest');
    expect(snapshot.status).toBe('live');
    expect(snapshot.sessionType).toBe('race');
    expect(snapshot.eventName).toBe('Baterias 21/05/2026 - BATERIA 21:40 - Corrida');
    expect(snapshot.trackName).toBe('Tracado 1');
    expect(snapshot.drivers).toEqual([
      { position: 1, kart: '121', name: 'VANDERSON', time: '1:05.100' },
      { position: 2, kart: '119', name: 'JONATHAN LINCOLN', time: '1:06.618' },
    ]);
  });

  it('prefers the current state 1 race over stale state 5 rows', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/Racing/getByState/1')) {
        return Response.json({
          success: true,
          data: [
            {
              Id_Racing: 516036,
              RacingState: 1,
              Name: 'teste',
              racingtype: { Name: 'Treino Classificatório' },
              racingtrack: { Name: 'Traçado 1' },
              racinggroup: { Name: 'TREINO' },
              racingevent: { Name: 'teste' },
            },
          ],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=516036')) {
        return Response.json({
          success: true,
          data: [
            { Pos: 2, Number: '22', Competitor: 'Competidor 22', BestLapTime: '2026-05-22T00:00:21.500-03:00' },
            { Pos: 1, Number: '26', Competitor: 'Competidor 26', BestLapTime: '2026-05-22T00:00:20.100-03:00' },
          ],
        });
      }

      throw new Error(`unexpected fetch ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLapTimeApiSnapshot({
      baseUrl: 'http://192.168.20.254/laptime',
      token: 'token',
    });

    expect(snapshot.source).toBe('rest');
    expect(snapshot.status).toBe('live');
    expect(snapshot.sessionType).toBe('qualifying');
    expect(snapshot.eventName).toBe('teste - TREINO - teste');
    expect(snapshot.drivers).toEqual([
      { position: 1, kart: '26', name: 'COMPETIDOR 26', time: '0:20.100' },
      { position: 2, kart: '22', name: 'COMPETIDOR 22', time: '0:21.500' },
    ]);
  });

  it('scans past empty or no-kart races until it finds API kart numbers', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/Racing/getByState/1?qtd=100')) {
        return Response.json({
          success: true,
          data: [{ Id_Racing: 100, RacingState: 1, Name: 'sem kart', racingtype: { Name: 'Corrida' } }],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=100')) {
        return Response.json({
          success: true,
          data: [{ Pos: 1, Competitor: 'Piloto sem kart', LapTime: '2026-05-22T00:01:00.000-03:00' }],
        });
      }

      if (url.includes('/Racing/getByState/2?qtd=100')) {
        return Response.json({
          success: true,
          data: [{ Id_Racing: 101, RacingState: 2, Name: 'com kart', racingtype: { Name: 'Corrida' } }],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=101')) {
        return Response.json({
          success: true,
          data: [{ Pos: 1, Number: '59', Competitor: 'Piloto com kart', LapTime: '2026-05-22T00:01:01.000-03:00' }],
        });
      }

      throw new Error(`unexpected fetch ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLapTimeApiSnapshot({
      baseUrl: 'http://192.168.20.254/laptime',
      token: 'token',
    });

    expect(snapshot.status).toBe('live');
    expect(snapshot.drivers).toEqual([{ position: 1, kart: '59', name: 'PILOTO COM KART', time: '1:01.000' }]);
  });

  it('ignores HTTP 400 for empty states and keeps scanning the LapTime states', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/Racing/getByState/1?qtd=100')) {
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      }

      if (url.includes('/Racing/getByState/2?qtd=100') || url.includes('/Racing/getByState/3?qtd=100') || url.includes('/Racing/getByState/4?qtd=100')) {
        return Response.json({ success: true, data: [] });
      }

      if (url.includes('/Racing/getByState/5?qtd=100')) {
        return Response.json({
          success: true,
          data: [{ Id_Racing: 102, RacingState: 5, Name: 'corrida em andamento', racingtype: { Name: 'Corrida' } }],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=102')) {
        return Response.json({
          success: true,
          data: [{ Pos: 1, Number: '106', Competitor: 'Firepit/ Apex 1', LapTime: '2026-05-22T00:01:02.000-03:00' }],
        });
      }

      throw new Error(`unexpected fetch ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLapTimeApiSnapshot({
      baseUrl: 'http://192.168.20.254/laptime',
      token: 'token',
    });

    expect(snapshot.status).toBe('live');
    expect(snapshot.drivers).toEqual([{ position: 1, kart: '106', name: 'FIREPIT/ APEX 1', time: '1:02.000' }]);
  });
});
