import { describe, expect, it, vi } from 'vitest';
import { fetchLapTimeApiSnapshot, formatLapTimeValue } from '@/lib/livetime/laptime-api';

describe('formatLapTimeValue', () => {
  it('formats LapTime SQL datetime values as timing cells', () => {
    expect(formatLapTimeValue('2026-05-22T00:01:06.618-03:00')).toBe('1:06.618');
    expect(formatLapTimeValue('2026-05-21T00:30:17.757796')).toBe('30:17.757');
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
          { Pos: 2, Number: '119', Competitor: 'Jonathan Lincoln', LapTime: '2026-05-22T00:01:06.618-03:00' },
          { Pos: 1, Number: '121', ShortName: 'FA2', Competitor: 'Firepit/ Apex 2', LapTime: '2026-05-22T00:01:05.100-03:00' },
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
      { position: 1, kart: '121', name: 'FA2', team: 'Firepit/ Apex 2', time: '1:05.100' },
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

  it('treats LapTime HTTP 400 no-result states as empty states', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/Racing/getByState/5')) {
        return Response.json({
          success: true,
          data: [{
            Id_Racing: 637101,
            RacingState: 5,
            Name: '500 MILHAS - TOMADA DE TEMPO',
            racingtype: { Name: 'Corrida' },
          }],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=637101')) {
        return Response.json({
          success: true,
          data: [{ Pos: 1, Number: '106', Competitor: 'FIREPIT/ APEX 1', LapTime: '2026-08-23T01:05:864Z' }],
        });
      }

      if (url.includes('/Racing/getByState/')) {
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      }

      throw new Error(`unexpected fetch ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLapTimeApiSnapshot({
      baseUrl: 'http://192.168.20.254/laptime/api',
      token: 'token',
    });

    expect(snapshot.status).toBe('live');
    expect(snapshot.drivers[0]?.kart).toBe('106');
  });

  it('prefers the active race over the qualifying row returned first by LapTime', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/Racing/getByState/5')) {
        return Response.json({
          success: true,
          data: [
            {
              Id_Racing: 637100,
              RacingState: 5,
              Name: '500 MILHAS - TOMADA DE TEMPO',
              StartDateTime: '2026-08-21T21:28:16.393Z',
              racingtype: { Name: 'Treino Classificatório' },
            },
            {
              Id_Racing: 637101,
              RacingState: 5,
              Name: '500 MILHAS',
              StartDateTime: '2026-08-22T09:52:17.875Z',
              racingtype: { Name: 'Corrida' },
            },
          ],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=637100')) {
        return Response.json({
          success: true,
          data: [{ Pos: 1, Number: '101', Competitor: 'MINAS RACING 1', LapTime: '2026-08-22T00:01:05.062-03:00' }],
        });
      }

      if (url.includes('/RacingCompetitor/ListResultByRacingId?idRacing=637101')) {
        return Response.json({
          success: true,
          data: [
            {
              Pos: 3,
              Number: '126',
              Competitor: 'ZERO27/AGUIA 2',
              LapTime: '2026-08-22T00:01:08.746-03:00',
              BestLapTime: '2026-08-22T00:01:04.839-03:00',
            },
            {
              Pos: 1,
              Number: '106',
              Competitor: 'FIREPIT/ APEX 1',
              LapTime: '2026-08-22T00:01:05.864-03:00',
              BestLapTime: '2026-08-22T00:01:04.589-03:00',
            },
            {
              Pos: 2,
              Number: '107',
              Competitor: 'FIREPIT/ APEX 2',
              LapTime: '2026-08-22T00:01:06.615-03:00',
              BestLapTime: '2026-08-22T00:01:04.825-03:00',
            },
          ],
        });
      }

      if (url.includes('/Racing/getByState/')) {
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      }

      throw new Error(`unexpected fetch ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchLapTimeApiSnapshot({
      baseUrl: 'http://192.168.20.254/laptime/api',
      token: 'token',
    });

    expect(snapshot.sessionType).toBe('race');
    expect(snapshot.drivers.slice(0, 3).map((driver) => [driver.position, driver.kart, driver.time])).toEqual([
      [1, '106', '1:04.589'],
      [2, '107', '1:04.825'],
      [3, '126', '1:04.839'],
    ]);
  });
});
