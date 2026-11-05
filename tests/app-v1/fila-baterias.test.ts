import { describe, expect, it } from 'vitest';
import { semBateriasPassadas } from '../../lib/app-v1/regras';

const agora = Date.parse('2026-11-01T14:00:00-03:00');
const hoje = Date.parse('2026-11-01T08:00:00-03:00');
const agenda = new Map([['1', '2026-11-01T08:30'], ['2', '2026-11-01T09:14'], ['3', '2026-11-01T13:20'], ['4', '2026-11-01T18:00']]);

describe('fila de baterias do app', () => {
  it('tira a preparada que foi ultrapassada e a de outro dia; mantém a próxima e a futura', () => {
    const insonia = { id: 'a', state: 'preparando', createdAt: hoje, agendaId: 1 };
    const ontem = { id: 'b', state: 'preparando', createdAt: hoje - 86_400_000, agendaId: 9 };
    const correu = { id: 'c', state: 'encerrada', createdAt: hoje, startedAt: hoje + 3_600_000, agendaId: 2 };
    const proxima = { id: 'd', state: 'preparando', createdAt: hoje, agendaId: 3 };
    const futura = { id: 'e', state: 'preparando', createdAt: hoje, agendaId: 4 };
    const avulsa = { id: 'f', state: 'preparando', createdAt: hoje, agendaId: null };
    expect(semBateriasPassadas([insonia, ontem, correu, proxima, futura, avulsa], agenda, agora).map((s) => s.id)).toEqual(['c', 'd', 'e', 'f']);
  });

  it('sem agenda só retira as de outros dias', () => {
    const insonia = { id: 'a', state: 'preparando', createdAt: hoje, agendaId: 1 };
    const correu = { id: 'c', state: 'encerrada', createdAt: hoje, startedAt: hoje, agendaId: 2 };
    expect(semBateriasPassadas([insonia, correu], new Map(), agora)).toHaveLength(2);
  });
});
