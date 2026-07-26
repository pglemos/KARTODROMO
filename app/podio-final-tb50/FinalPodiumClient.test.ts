import { describe, expect, it } from 'vitest';
import { shouldPollManualDisplayMode } from './FinalPodiumClient';

describe('automatic final podium display-mode guard', () => {
  it('does not leave the automatic podium just because the stored manual mode is live', () => {
    expect(shouldPollManualDisplayMode(false, false, false)).toBe(false);
  });

  it('keeps the live-mode control active for a manually requested final podium', () => {
    expect(shouldPollManualDisplayMode(false, false, true)).toBe(true);
  });

  it('does not poll the manual mode for forced previews or demos', () => {
    expect(shouldPollManualDisplayMode(true, false, true)).toBe(false);
    expect(shouldPollManualDisplayMode(false, true, true)).toBe(false);
  });
});
