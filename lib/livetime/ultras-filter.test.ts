import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ULTRAS_GROUP_IDS,
  isUltrasRacing,
  matchUltrasRacing,
  ultrasFilterSummary,
} from '@/lib/livetime/ultras-filter';
import type { UltrasRacingCandidate } from '@/lib/livetime/ultras-filter';

function racing(overrides: Partial<UltrasRacingCandidate> = {}): UltrasRacingCandidate {
  return {
    id: 627099,
    racingGroupId: 7,
    racingEventId: 380462,
    racingTypeId: 4,
    state: 5,
    name: 'CORRIDA',
    groupName: 'BATERIA 17:00',
    eventName: 'Baterias 18/08/2026',
    ...overrides,
  };
}

describe('matchUltrasRacing', () => {
  it('reconhece corrida pelo Id_RacingGroup na whitelist (ID estruturado)', () => {
    const match = matchUltrasRacing(racing({ racingGroupId: 220296 }));
    expect(match.kind).toBe('id');
    expect(match.reason).toContain('whitelist');
  });

  it('reconhece qualquer grupo ULTRAS conhecido', () => {
    for (const groupId of DEFAULT_ULTRAS_GROUP_IDS) {
      expect(matchUltrasRacing(racing({ racingGroupId: groupId })).kind).toBe('id');
    }
  });

  it('rejeita corrida sem vínculo ULTRAS', () => {
    const match = matchUltrasRacing(racing());
    expect(match.kind).toBe('none');
    expect(isUltrasRacing(racing())).toBe(false);
  });

  it('casa por texto apenas com allowTextOnly=true (candidato por padrão)', () => {
    const textRace = racing({ groupName: 'ULTRAS III - FINAL' });
    expect(matchUltrasRacing(textRace).kind).toBe('text');
    expect(isUltrasRacing(textRace)).toBe(false);
    expect(isUltrasRacing(textRace, { allowTextOnly: true })).toBe(true);
  });

  it('normaliza acentos e caixa no fallback textual', () => {
    const race = racing({ groupName: 'ULTRÁS  III', eventName: 'FINAL' });
    expect(matchUltrasRacing(race).kind).toBe('text');
  });

  it('nunca remove o padrão mandatório "ultras" mesmo com namePatterns vazio', () => {
    const race = racing({ groupName: 'ULTRA FINAL' });
    expect(matchUltrasRacing(race, { namePatterns: ['outro'] }).kind).toBe('text');
  });

  it('respeita grupos adicionais via options.knownGroupIds', () => {
    const race = racing({ racingGroupId: 999001 });
    expect(isUltrasRacing(race, { knownGroupIds: [...DEFAULT_ULTRAS_GROUP_IDS, 999001] })).toBe(true);
  });

  it('sem grupo/evento/nome não casa texto', () => {
    const race = racing({ groupName: undefined, eventName: undefined, name: undefined });
    expect(matchUltrasRacing(race).kind).toBe('none');
  });

  it('resumo de auditoria contém grupos e padrões', () => {
    const summary = ultrasFilterSummary();
    expect(summary).toContain('grupos=[');
    expect(summary).toContain('padrões=[');
    expect(summary).toContain('ultra');
  });
});