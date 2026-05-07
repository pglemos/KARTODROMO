import { describe, expect, it } from 'vitest';
import { extractDriversFromTable, inferStatusFromText } from '@/lib/livetime/dom-extractor';

describe('dom extractor', () => {
  it('maps LiveTime table headers to internal fields', () => {
    const result = extractDriversFromTable(['P', '#', 'Name', 'Lap', 'Time', 'Gap', 'Interval', 'B.Lap', 'B.Time'], [
      { cells: ['1', '105', 'Matteo', '6', '00:33.012', '00:00.000', '00:00.000', '6', '00:33.012'] },
      { cells: ['2', '133', 'Felis', '6', '00:33.013', '00:00.095', '00:00.095', '6', '00:33.013'] },
    ]);

    expect(result).toEqual([
      { position: 1, kart: '105', name: 'MATTEO', time: '00:33.012' },
      { position: 2, kart: '133', name: 'FELIS', time: '00:33.013' },
    ]);
  });

  it('identifies waiting status from page text', () => {
    expect(inferStatusFromText('Aguarde, sua corrida já vai começar...', [])).toBe('waiting');
    expect(inferStatusFromText('classificacao', [])).toBe('empty');
  });
});
