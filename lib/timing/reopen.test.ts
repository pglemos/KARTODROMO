import { describe, it, expect } from 'vitest';
import * as E from './race-engine';
describe('reopen', () => {
  it('mantém tempo', () => {
    const s = E.createSession({ id: 't', name: 't', type: 'corrida', durationMin: 20, now: 0 });

    E.startSession(s, 1000); s.startedAt = 2000;
    E.closeSession(s, 62000);
    expect(E.elapsedMs(s, 99999)).toBe(60000);
    E.reopenSession(s, 100000);
    expect(s.state).toBe('em_andamento');
    expect(E.elapsedMs(s, 150000)).toBe(60000);
    E.setRaceFlag(s, 'green', 200000);
    expect(E.elapsedMs(s, 210000)).toBe(70000);
  });
});
