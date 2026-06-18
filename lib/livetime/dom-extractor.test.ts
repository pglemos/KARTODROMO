import { describe, expect, it } from 'vitest';
import {
  extractDriversFromLapTimeCards,
  extractDriversFromResultCards,
  extractDriversFromTable,
  extractEventNames,
  inferSessionTypeFromText,
  inferStatusFromText,
} from '@/lib/livetime/dom-extractor';

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
  it('identifies finished status before live rows', () => {
    expect(inferStatusFromText('Classificacao final', [{ position: 1, kart: '105', name: 'MATTEO', time: '00:33.012' }])).toBe('finished');
    expect(inferStatusFromText('Race finished', [])).toBe('finished');
    expect(inferStatusFromText('Tabela de classificacao', [{ position: 1, kart: '', name: 'MATTEO', time: '00:33.012' }], true)).toBe('finished');
  });

  it('detects qualifying versus race session text', () => {
    expect(inferSessionTypeFromText('Treino classificatorio - Tomada de tempo')).toBe('qualifying');
    expect(inferSessionTypeFromText('BATERIA 1 (Corrida) - Tracado 1')).toBe('race');
    expect(inferSessionTypeFromText('Tabela de classificacao')).toBe('unknown');
  });

  it('maps LapTime Web TV competitor cards to internal fields', () => {
    const result = extractDriversFromLapTimeCards([
      { cells: ['1', '#105 Competidor 105', 'U-Lap 01:07.843', 'B-Lap 01:06.867', 'Diff 00:00.000', 'Gap 00:00.000'] },
      { cells: ['2', '#20 Competidor 20', 'U-Lap 00:27.951', 'B-Lap 00:20.675', 'Diff 14:41.551', 'Gap 14:41.551'] },
      { cells: ['P11', 'Competidor 21', '', '', '', '+01.674', 'P11 Competidor 21 #21 +01.674'] },
    ]);

    expect(result).toEqual([
      { position: 1, kart: '105', name: 'COMPETIDOR 105', time: '01:06.867' },
      { position: 2, kart: '20', name: 'COMPETIDOR 20', time: '+14:41.551' },
      { position: 11, kart: '21', name: 'COMPETIDOR 21', time: '+01.674' },
    ]);
  });

  it('prefers the race line and track from LapTime Web TV text', () => {
    const result = extractEventNames(['wifi_tethering', 'AULAS ANDERSON', 'SUPER KART', 'AULAS ANDERSON SILVEIRA (Corrida) - Traçado 1'].join('\n'));

    expect(result).toEqual({
      eventName: 'AULAS ANDERSON SILVEIRA (Corrida) - Traçado 1',
      trackName: 'Traçado 1',
    });
  });

  it('maps LapTime result cards when the race page hides kart numbers', () => {
    const result = extractDriversFromResultCards([
      { cells: ['1', '1:18.460', 'LEONARDO FIGUEIREDO', ''] },
      { cells: ['2', '1:19.081', 'MARCOS SIDNEY', ''] },
    ]);

    expect(result).toEqual([
      { position: 1, kart: '', name: 'LEONARDO FIGUEIREDO', time: '1:18.460' },
      { position: 2, kart: '', name: 'MARCOS SIDNEY', time: '1:19.081' },
    ]);
  });
});
