import { describe, expect, it } from 'vitest';
import {
  CRONOMETRAGEM_REPORT_TYPES,
  selecionarSessoesParaRelatorio,
  sessaoDataReferencia,
  urlRelatorioCronometragem,
} from '../../lib/timing/reception-crono-reports';

describe('relatórios da cronometragem na recepção', () => {
  it('mantém baterias encerradas mesmo quando a sessão não tem startedAt', () => {
    const sessoes = [
      { id: 'sem-inicio', name: 'BATERIA 09:00', type: 'corrida', state: 'encerrada', createdAt: 1790499600000, finishedAt: 1790501400000 },
      { id: 'fora-do-dia', name: 'BATERIA antiga', type: 'corrida', state: 'encerrada', createdAt: 1790413200000, finishedAt: 1790415000000 },
    ];

    expect(sessaoDataReferencia(sessoes[0])).toBe(1790501400000);
    expect(selecionarSessoesParaRelatorio(sessoes, '2026-09-27', '2026-09-27').map((s) => s.id)).toEqual(['sem-inicio']);
  });

  it('usa o relatório oficial da cronometragem e preserva a escolha do tipo', () => {
    expect(CRONOMETRAGEM_REPORT_TYPES.map((t) => t.slug)).toContain('resultados_oficiais');
    expect(CRONOMETRAGEM_REPORT_TYPES.map((t) => t.slug)).toContain('volta_a_volta');
    expect(urlRelatorioCronometragem('http://192.168.20.249:4050', 'sessao-1', 'resultados_oficiais'))
      .toBe('http://192.168.20.249:4050/resultado/sessao-1?tipo=resultados_oficiais');
  });
});
