import { describe, expect, it } from 'vitest';
import {
  buildEntriesDraft,
  buildResultDraft,
  competitorDisplayName,
  enduranceCoDrivers,
  enduranceRacing,
  entryStatusFromCompetitor,
  fastestLapCompetitorId,
  fastestLapMillis,
  lapTimeToMillis,
  markFastestLap,
  racingFinished,
} from '@/lib/udk-bridge/transform';
import type { LapTimeCompetitorRow, LapTimeRacingRow, UdkBridgeConfig } from '@/lib/udk-bridge/types';

const config: UdkBridgeConfig = {
  championshipId: 'champ',
  seasonId: 'season',
  categoryMapping: {},
  stages: {
    stage1: [{ sessionId: 'session1', name: 'Corrida 1', kind: 'race' }],
  },
};

function competitor(overrides: Partial<LapTimeCompetitorRow> = {}): LapTimeCompetitorRow {
  return {
    Id_RacingCompetitor: 1,
    Id_Racing: 627099,
    Number: '78',
    Competitor: 'Cristiano Miranda',
    ShortName: 'CRM',
    Pos: 1,
    Lap: 14,
    BestLapTime: new Date('1970-01-01T00:01:21.662Z'),
    TotalTime: new Date('2026-08-18T00:19:59.146Z'),
    RacingStatus: 0,
    IsHidden: false,
    ...overrides,
  };
}

function racing(overrides: Partial<LapTimeRacingRow> = {}): LapTimeRacingRow {
  return {
    Id_Racing: 627099,
    RacingState: 5,
    Name: 'CORRIDA',
    Id_RacingType: 4,
    RacingTypeName: 'Corrida',
    Id_RacingGroup: 7,
    RacingGroupName: 'BATERIA 17:00',
    Id_RacingEvent: 380462,
    RacingEventName: 'Baterias 18/08/2026',
    ...overrides,
  };
}

describe('lapTimeToMillis', () => {
  it('converte datetime 1970 em milissegundos de volta', () => {
    expect(lapTimeToMillis(new Date('1970-01-01T00:01:21.662Z'))).toBe(81662);
  });

  it('retorna null para nulo/undefined', () => {
    expect(lapTimeToMillis(null)).toBeNull();
    expect(lapTimeToMillis(undefined)).toBeNull();
  });
});

describe('racingFinished', () => {
  it('considera finalizada RacingState 5 ou 6', () => {
    expect(racingFinished(racing({ RacingState: 5 }))).toBe(true);
    expect(racingFinished(racing({ RacingState: 6 }))).toBe(true);
    expect(racingFinished(racing({ RacingState: 1 }))).toBe(false);
    expect(racingFinished(racing({ RacingState: 0 }))).toBe(false);
  });
});

describe('entryStatusFromCompetitor', () => {
  it('classifica posição válida com voltas', () => {
    expect(entryStatusFromCompetitor(competitor())).toBe('classified');
  });

  it('desclassifica RacingStatus=2', () => {
    expect(entryStatusFromCompetitor(competitor({ RacingStatus: 2, Pos: 5, Lap: 10 }))).toBe('disqualified');
  });

  it('did_not_finish sem voltas', () => {
    expect(entryStatusFromCompetitor(competitor({ Pos: 0, Lap: 0 }))).toBe('did_not_finish');
  });

  it('not_classified quando posição zero mas com voltas', () => {
    expect(entryStatusFromCompetitor(competitor({ Pos: 0, Lap: 7 }))).toBe('not_classified');
  });
});

describe('endurance', () => {
  it('detecta corrida endurance por Name2..Name6', () => {
    const solo = competitor();
    const team = competitor({ Name2: 'João Silva', Transponder2: 781 });
    expect(enduranceRacing([solo])).toBe(false);
    expect(enduranceRacing([team])).toBe(true);
    expect(enduranceCoDrivers(team)).toEqual(['João Silva']);
  });

  it('ignora nomes em branco na lista de co-pilotos', () => {
    expect(enduranceCoDrivers(competitor({ Name2: '  ' }))).toEqual([]);
  });
});

describe('fastest lap', () => {
  it('calcula melhor volta global', () => {
    const slow = competitor({ Id_RacingCompetitor: 1, BestLapTime: new Date('1970-01-01T00:01:25.000Z') });
    const fast = competitor({ Id_RacingCompetitor: 2, BestLapTime: new Date('1970-01-01T00:01:21.662Z') });
    expect(fastestLapMillis([slow, fast])).toBe(81662);
    expect(fastestLapCompetitorId([slow, fast])).toBe(2);
  });

  it('marca fastest_lap na entrada correspondente', () => {
    const competitors = [
      competitor({ Id_RacingCompetitor: 1, BestLapTime: new Date('1970-01-01T00:01:25.000Z') }),
      competitor({ Id_RacingCompetitor: 2, BestLapTime: new Date('1970-01-01T00:01:21.662Z') }),
    ];
    const entries = markFastestLap(buildEntriesDraft(competitors), competitors);
    expect(entries.find((e) => e.external_competitor_id === 2)?.fastest_lap).toBe(true);
    expect(entries.find((e) => e.external_competitor_id === 1)?.fastest_lap).toBe(false);
  });
});

describe('buildEntriesDraft', () => {
  it('constrói entradas ordenadas por posição', () => {
    const competitors = [
      competitor({ Id_RacingCompetitor: 2, Pos: 2, Number: '66' }),
      competitor({ Id_RacingCompetitor: 1, Pos: 1, Number: '78' }),
    ];
    const entries = buildEntriesDraft(competitors);
    expect(entries.map((e) => e.position)).toEqual([1, 2]);
    expect(entries[0].kart_number).toBe(78);
    expect(entries[0].total_time_ms).toBe(19 * 60000 + 59 * 1000 + 146);
    expect(entries[0].best_lap_ms).toBe(81662);
    expect(entries[0].external_competitor_id).toBe(1);
  });

  it('filtra competidores ocultos', () => {
    const entries = buildEntriesDraft([competitor({ IsHidden: true })]);
    expect(entries).toHaveLength(0);
  });

  it('exclui competidores sem posição e sem voltas', () => {
    const entries = buildEntriesDraft([competitor({ Pos: 0, Lap: 0 })]);
    expect(entries).toHaveLength(0);
  });

  it('propaga penalidade', () => {
    const entries = buildEntriesDraft([competitor({ PenaltyTotalTime: new Date('1970-01-01T00:00:05.000Z') })]);
    expect(entries[0].penalty_ms).toBe(5000);
  });
});

describe('buildResultDraft', () => {
  it('gera título e vincula etapa/sessão', () => {
    const draft = buildResultDraft(racing(), config);
    expect(draft.status).toBe('draft');
    expect(draft.source_system).toBe('laptime');
    expect(draft.external_racing_id).toBe(627099);
    expect(draft.stage_id).toBe('stage1');
    expect(draft.session_id).toBe('session1');
    expect(draft.title).toContain('BATERIA 17:00');
  });

  it('nunca publica: status fixo draft', () => {
    expect(buildResultDraft(racing(), config).status).toBe('draft');
  });
});

describe('competitorDisplayName', () => {
  it('prefere o nome completo (Competitor) à sigla ShortName', () => {
    expect(competitorDisplayName(competitor())).toBe('CRISTIANO MIRANDA');
  });

  it('cai para ShortName quando não há nome completo', () => {
    expect(competitorDisplayName(competitor({ Competitor: undefined }))).toBe('CRM');
  });
});