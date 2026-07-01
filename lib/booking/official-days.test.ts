import { describe, expect, it } from 'vitest';

import { mergeOfficialDays, type OfficialDay } from './official-days';

const day = (dayNumber: number, monthIndex: number, year = 2026): OfficialDay => ({
  day: dayNumber,
  weekday: '',
  monthIndex,
  year,
  selected: false,
});

describe('mergeOfficialDays', () => {
  it('keeps early next-month days discovered in the previous official range', () => {
    const previousRange = [
      day(17, 5),
      day(30, 5),
      day(1, 6),
      day(2, 6),
      day(3, 6),
      day(4, 6),
      day(5, 6),
      day(6, 6),
    ];
    const nextRange = [day(7, 6), day(8, 6), day(20, 6)];

    const mergedJulyDays = mergeOfficialDays(previousRange, nextRange)
      .filter((officialDay) => officialDay.monthIndex === 6)
      .map((officialDay) => officialDay.day);

    expect(mergedJulyDays).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 20]);
  });
});
