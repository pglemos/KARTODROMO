import { describe, expect, it } from 'vitest';
import {
  isPitStopInsideBoxWindow,
  pitStopEntryTimeMs,
  PIT_RULES,
  summarizePitStops,
} from '@/lib/livetime/laptime-pit-stops';

describe('janela de boxes das paradas', () => {
  it('usa o momento de entrada nos boxes quando a passagem termina depois das 11h40', () => {
    const raceTimeMs = 700 * 60_000 + 48_670;
    const stopDurationMs = 7 * 60_000 + 2_874;

    expect(pitStopEntryTimeMs(raceTimeMs, stopDurationMs)).toBe(693 * 60_000 + 45_796);
    expect(isPitStopInsideBoxWindow(raceTimeMs, stopDurationMs)).toBe(true);
  });

  it('rejeita uma parada cuja entrada ocorre antes da abertura dos boxes', () => {
    const raceTimeMs = PIT_RULES.boxOpenAfterMs + 6 * 60_000;
    const stopDurationMs = 7 * 60_000;

    expect(isPitStopInsideBoxWindow(raceTimeMs, stopDurationMs)).toBe(false);
  });

  it('rejeita uma parada iniciada depois do fechamento dos boxes', () => {
    const raceTimeMs = PIT_RULES.boxCloseAfterMs + 7 * 60_000 + 1;
    const stopDurationMs = 7 * 60_000;

    expect(isPitStopInsideBoxWindow(raceTimeMs, stopDurationMs)).toBe(false);
  });

  it('classifica de 4:00.000 a 6:59.999 como parada errada e aplica 7 voltas por obrigação faltante', () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, index) => ({
        Id_Passing: index + 1,
        Id_RacingCompetitor: 10,
        Lap: index + 20,
        LapTime: '7:00.000',
        TotalTime: `${17 + index}:00.000`,
        Pos: 1,
        InvalidLap: false,
        DeletedLap: false,
      })),
      {
        Id_Passing: 11,
        Id_RacingCompetitor: 10,
        Lap: 30,
        LapTime: '6:59.999',
        TotalTime: '30:00.000',
        Pos: 1,
        InvalidLap: false,
        DeletedLap: false,
      },
      {
        Id_Passing: 12,
        Id_RacingCompetitor: 10,
        Lap: 31,
        LapTime: '4:00.000',
        TotalTime: '31:00.000',
        Pos: 1,
        InvalidLap: false,
        DeletedLap: false,
      },
    ];

    const summary = summarizePitStops(
      {
        Id_RacingCompetitor: 10,
        Pos: 1,
        Number: '106',
        Transponder: null,
        Competitor: 'Equipe 106',
        ShortName: 'E106',
        Lap: 31,
        TotalTime: '31:00.000',
      },
      rows,
    );

    expect(summary.mandatory).toBe(10);
    expect(summary.short).toBe(2);
    expect(summary.remaining).toBe(1);
    expect(summary.penaltyLaps).toBe(7);
    expect(summary.stops.filter((stop) => stop.status === 'short')).toHaveLength(2);
  });
});
