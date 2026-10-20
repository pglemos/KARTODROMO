import { ordenarBaterias, resumoCarreira } from '../src/features/results/resumo';

const linha = (position: number, bestLapMs: number | null) => ({
  sessionId: `s${position}`, eventName: 'BATERIA', eventDate: '2026-10-18', displayName: 'Ana', position, kart: '4', laps: 10, bestLapMs,
});

describe('resultados: resumo e ordem', () => {
  it('conta baterias, vitórias, pódios e a melhor volta', () => {
    expect(resumoCarreira([linha(1, 75_000), linha(3, 74_100), linha(7, null), linha(2, 76_000)]))
      .toEqual({ baterias: 4, vitorias: 1, podios: 3, melhorVolta: 74_100 });
    expect(resumoCarreira([])).toEqual({ baterias: 0, vitorias: 0, podios: 0, melhorVolta: null });
  });

  it('mais recente primeiro, pela data e pela hora do nome (9:15 antes de 17:25 no mesmo dia)', () => {
    const b = (eventDate: string, eventName: string) => ({ sessionId: eventName + eventDate, eventName, eventDate, results: [] });
    const ordem = ordenarBaterias([
      b('2026-10-18', 'BATERIA 9:15 · CORRIDA'), b('2026-10-18', 'BATERIA 17:25 · TOMADA DE TEMPO'),
      b('2026-10-17', 'BATERIA 21:00 · CORRIDA'), b('2026-10-18', 'BATERIA 17:25 · CORRIDA'),
    ]).map((x) => `${x.eventDate} ${x.eventName}`);
    expect(ordem).toEqual([
      '2026-10-18 BATERIA 17:25 · CORRIDA', '2026-10-18 BATERIA 17:25 · TOMADA DE TEMPO',
      '2026-10-18 BATERIA 9:15 · CORRIDA', '2026-10-17 BATERIA 21:00 · CORRIDA',
    ]);
  });
});
