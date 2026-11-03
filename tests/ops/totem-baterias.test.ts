import { describe, expect, it } from 'vitest';
import { TOTEM_BATERIAS_SQL, bateriaDisponivelNoTotem } from '../../lib/ops/totem-baterias';

describe('baterias visíveis no autoatendimento', () => {
  it('bloqueia bateria aberta de hoje cujo horário inicial já passou', () => {
    expect(bateriaDisponivelNoTotem({
      inicio: '2026-09-27T12:10:00',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      livres: 12,
    }, '2026-09-27', '2026-09-27T12:15:00')).toBe(false);
  });

  it('mantém visível bateria aberta futura com vagas disponíveis', () => {
    expect(bateriaDisponivelNoTotem({
      inicio: '2026-09-27T12:30:00',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      livres: 12,
    }, '2026-09-27', '2026-09-27T12:15:00')).toBe(true);
  });

  it('não mostra bateria de outro dia, fechada ou sem vagas', () => {
    const base = {
      inicio: '2026-09-27T13:00:00',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      livres: 12,
    };

    expect(bateriaDisponivelNoTotem({ ...base, inicio: '2026-09-26T13:00:00' }, '2026-09-27', '2026-09-27T12:00:00')).toBe(false);
    expect(bateriaDisponivelNoTotem({ ...base, status: 'fechada' }, '2026-09-27', '2026-09-27T12:00:00')).toBe(false);
    expect(bateriaDisponivelNoTotem({ ...base, livres: 0 }, '2026-09-27', '2026-09-27T12:00:00')).toBe(false);
  });

  it('filtra início a partir de SYSDATETIME() para não disponibilizar baterias passadas', () => {
    expect(TOTEM_BATERIAS_SQL).toContain('b.Inicio >= SYSDATETIME()');
    expect(TOTEM_BATERIAS_SQL).toContain('CAST(SYSDATETIME() AS date)');
  });
});
