import { describe, expect, it } from 'vitest';
import { getPositionForCell } from '@/lib/livetime/layout';

describe('layout position distribution', () => {
  it('distributes positions in six horizontal groups with five rows', () => {
    const rows = Array.from({ length: 5 }, (_, rowIndex) =>
      Array.from({ length: 6 }, (_, groupIndex) => getPositionForCell(rowIndex, groupIndex)),
    );

    expect(rows).toEqual([
      [1, 6, 11, 16, 21, 26],
      [2, 7, 12, 17, 22, 27],
      [3, 8, 13, 18, 23, 28],
      [4, 9, 14, 19, 24, 29],
      [5, 10, 15, 20, 25, 30],
    ]);
  });
});
