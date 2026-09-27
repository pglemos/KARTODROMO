import { describe, expect, it } from 'vitest';
import { TOTEM_BATERIAS_SQL, bateriaDisponivelNoTotem } from '../../lib/ops/totem-baterias';

describe('baterias visíveis no autoatendimento', () => {
  it('mantém visível uma bateria aberta de hoje mesmo depois do horário inicial', () => {
    expect(bateriaDisponivelNoTotem({
      inicio: '2026-09-27T12:10:00',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      livres: 12,
    }, '2026-09-27')).toBe(true);
  });

  it('não mostra bateria de outro dia, fechada ou sem vagas', () => {
    const base = {
      inicio: '2026-09-27T12:10:00',
      status: 'aberta',
      autoAtendimento: true,
      reservaFechada: false,
      livres: 12,
    };

    expect(bateriaDisponivelNoTotem({ ...base, inicio: '2026-09-26T12:10:00' }, '2026-09-27')).toBe(false);
    expect(bateriaDisponivelNoTotem({ ...base, status: 'fechada' }, '2026-09-27')).toBe(false);
    expect(bateriaDisponivelNoTotem({ ...base, livres: 0 }, '2026-09-27')).toBe(false);
  });

  it('usa o dia corrente como limite inferior, não uma janela de dez minutos', () => {
    expect(TOTEM_BATERIAS_SQL).toContain('CAST(SYSDATETIME() AS date)');
    expect(TOTEM_BATERIAS_SQL).not.toContain('DATEADD(minute, -10, SYSDATETIME())');
  });
});
