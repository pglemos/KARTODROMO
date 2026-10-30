import { describe, expect, it } from 'vitest';
import { analisarCorrida, avaliarPeso, desempenhoDosKarts, lastroNecessario, lerRegras, REGRAS_100_MILHAS, sortearFileira, type VoltaCrono } from '../lib/ops/endurance-regras';
// os testes de peso usam a escala de 100 kg (o padrão do evento é 90 kg; as regras são as mesmas deslocadas)
const R = { ...REGRAS_100_MILHAS, pesoMinKg: 100, dqEquipeAbaixoKg: 95 };

const INICIO = Date.UTC(2026, 9, 25, 13, 0, 0); // 25/10/2026 10:00 em Brasília

/** Monta as voltas de uma equipe a partir dos tempos (ms), contando o relógio desde a largada. */
function voltas(tempos: number[]): VoltaCrono[] {
  let t = INICIO;
  return tempos.map((ms, i) => { t += ms; return { lap: i + 1, lapMs: ms, wallMs: t }; });
}
const n = (q: number, ms: number) => Array<number>(q).fill(ms);
const MIN = 60_000;

describe('peso do piloto', () => {
  it('100 kg ou mais está ok', () => {
    expect(avaliarPeso(100, R).resultado).toBe('ok');
    expect(avaliarPeso(104.3, R).punicaoSeg).toBe(0);
  });
  it('1 minuto a cada 500 g (ou fração) abaixo, até 2 kg', () => {
    expect(avaliarPeso(99.9, R)).toMatchObject({ resultado: 'punicao', punicaoSeg: 60 });
    expect(avaliarPeso(99.5, R)).toMatchObject({ resultado: 'punicao', punicaoSeg: 60 });
    expect(avaliarPeso(99.4, R)).toMatchObject({ resultado: 'punicao', punicaoSeg: 120 });
    expect(avaliarPeso(98, R)).toMatchObject({ resultado: 'punicao', punicaoSeg: 240 });
  });
  it('mais de 2 kg abaixo desclassifica o kart; abaixo de 95 kg, a equipe', () => {
    expect(avaliarPeso(97.9, R)).toMatchObject({ resultado: 'dq', dqEquipe: false });
    expect(avaliarPeso(94.9, R)).toMatchObject({ resultado: 'dq', dqEquipe: true });
  });
  it('lastro em passos de 0,5 kg, avisando acima de 50 kg', () => {
    expect(lastroNecessario(72.3, R)).toEqual({ lastroKg: 28, acimaDoLimite: false });
    expect(lastroNecessario(100.2, R)).toEqual({ lastroKg: 0, acimaDoLimite: false });
    expect(lastroNecessario(48, R).acimaDoLimite).toBe(true);
  });
});

describe('sorteio da fileira', () => {
  const filas = new Map([[1, ['12', '7']], [2, []], [3, ['30']], [4, ['5', '9']]]);
  it('a bolinha diz a fileira e o kart é o primeiro dela', () => {
    expect(sortearFileira(filas, 4)).toEqual({ fileira: 4, kart: '5' });
  });
  it('fileira vazia não vale', () => {
    expect(() => sortearFileira(filas, 2)).toThrow(/vazia/);
  });
  it('sorteio pelo sistema só cai em fileira com kart', () => {
    expect(sortearFileira(filas, null, () => 0.4)).toEqual({ fileira: 3, kart: '30' });
  });
});

describe('regras da corrida pelo decoder', () => {
  const regras = lerRegras(null);
  const sessao = (min: number, state = 'em_andamento') => ({ startedAt: INICIO, elapsedMs: min * MIN, durationMs: 150 * MIN, state });
  // equipe 101: 3 paradas boas (volta do box = 65 s + 7:02)
  const e101 = voltas([...n(20, 65_000), 65_000 + 7 * MIN + 2_000, ...n(30, 65_000), 65_000 + 7 * MIN + 500, ...n(30, 65_000), 65_000 + 7 * MIN + 10, ...n(10, 65_000)]);
  // equipe 102: uma parada na faixa de punição (6:57) e uma rápida
  const e102 = voltas([...n(20, 66_000), 66_000 + 6 * MIN + 57_000, ...n(30, 66_000), 66_000 + 60_000, ...n(30, 66_000)]);
  const base = {
    regras, equipes: [{ id: 1, numero: '101', nome: 'Alfa' }, { id: 2, numero: '102', nome: 'Beta' }],
    voltas: new Map([['101', e101], ['102', e102]]),
    trocas: [
      { equipeId: 1, pilotoId: 10, pilotoNome: 'Ana', kart: '12', tipo: 'largada', emMs: INICIO - 5 * MIN },
      { equipeId: 1, pilotoId: 11, pilotoNome: 'Bia', kart: '30', tipo: 'parada', emMs: INICIO + 25 * MIN },
    ],
    punicoes: [], ajustes: [],
  };

  it('acha as paradas, o tempo descontando a volta normal e quanto perdeu', () => {
    const a = analisarCorrida({ ...base, sessao: sessao(120), agoraMs: INICIO + 120 * MIN });
    const alfa = a.equipes.find((e) => e.numero === '101')!;
    expect(alfa.paradas.map((p) => p.tempoMs)).toEqual([7 * MIN + 2_000, 7 * MIN + 500, 7 * MIN + 10]);
    expect(alfa.paradasValidas).toBe(3);
    expect(alfa.paradasFaltando).toBe(0);
    expect(alfa.tempoPerdidoMs).toBe(2_510);
    expect(alfa.stints.map((s) => [s.voltaIni, s.voltaFim, s.piloto])).toEqual([[1, 20, 'Ana'], [22, 51, 'Bia'], [53, 82, 'Bia'], [84, 93, 'Bia']]);
  });

  it('parada entre 6:55 e 6:59.999 vale com +15 s; rápida não conta como obrigatória', () => {
    const a = analisarCorrida({ ...base, sessao: sessao(120), agoraMs: INICIO + 120 * MIN });
    const beta = a.equipes.find((e) => e.numero === '102')!;
    expect(beta.paradas.map((p) => p.situacao)).toEqual(['valida_punida', 'rapida']);
    expect(beta.punicaoSeg).toBe(15);
    expect(beta.paradasFaltando).toBe(2);
    expect(beta.voltasPerdidas).toBe(0); // durante a prova só aparece como previsto
    expect(beta.voltasPerdidasPrevistas).toBe(14);
  });

  it('no fim, cada parada obrigatória que falta tira 7 voltas', () => {
    const a = analisarCorrida({ ...base, sessao: sessao(150, 'encerrada'), agoraMs: INICIO + 151 * MIN });
    const beta = a.equipes.find((e) => e.numero === '102')!;
    expect(beta.voltasPerdidas).toBe(14);
  });

  it('mais de 5 paradas desclassifica', () => {
    const muitas = voltas([...n(10, 65_000), ...Array(6).fill(0).flatMap(() => [65_000 + 2 * MIN + 10_000 + 60_000, ...n(5, 65_000)])]);
    const a = analisarCorrida({ ...base, equipes: [{ id: 3, numero: '103', nome: 'Gama' }], voltas: new Map([['103', muitas]]), sessao: sessao(100), agoraMs: INICIO + 100 * MIN });
    expect(a.equipes[0].desclassificada).toBe(true);
  });

  it('parada com o box fechado vira alerta grave, a não ser que o box marque quebra', () => {
    const cedo = voltas([65_000, 65_000 + 7 * MIN + 1000, ...n(5, 65_000)]); // entrou aos ~1 min de prova
    const a = analisarCorrida({ ...base, equipes: [{ id: 4, numero: '104', nome: 'Delta' }], voltas: new Map([['104', cedo]]), sessao: sessao(20), agoraMs: INICIO + 20 * MIN });
    expect(a.equipes[0].alertas.some((x) => x.nivel === 'grave')).toBe(true);
    const ok = analisarCorrida({ ...base, equipes: [{ id: 4, numero: '104', nome: 'Delta' }], voltas: new Map([['104', cedo]]), ajustes: [{ equipeId: 4, volta: 2, acao: 'quebra' }], sessao: sessao(20), agoraMs: INICIO + 20 * MIN });
    expect(ok.equipes[0].alertas.some((x) => x.nivel === 'grave')).toBe(false);
  });

  it('classificação oficial desconta voltas perdidas e soma tempo de punição', () => {
    const a = analisarCorrida({ ...base, punicoes: [{ equipeId: 1, tipo: 'voltas', valor: 20, motivo: 'teste' }], sessao: sessao(120), agoraMs: INICIO + 120 * MIN });
    expect(a.equipes[0].numero).toBe('102');
    expect(a.equipes.find((e) => e.numero === '101')!.posPista).toBe(1);
  });

  it('janela do box: abre aos 5 min e fecha aos 2h10', () => {
    expect(analisarCorrida({ ...base, sessao: sessao(3), agoraMs: INICIO + 3 * MIN }).boxAberto).toBe(false);
    expect(analisarCorrida({ ...base, sessao: sessao(60), agoraMs: INICIO + 60 * MIN }).boxAberto).toBe(true);
    expect(analisarCorrida({ ...base, sessao: sessao(131), agoraMs: INICIO + 131 * MIN }).boxAberto).toBe(false);
  });

  it('projeção, ultrapassagem e desempenho dos karts saem preenchidos', () => {
    const a = analisarCorrida({ ...base, sessao: sessao(120), agoraMs: INICIO + 120 * MIN });
    for (const e of a.equipes) { expect(e.projecaoVoltas).toBeGreaterThan(e.voltas); expect(e.ultrapassagem).toHaveLength(11); }
    expect(desempenhoDosKarts(a).map((k) => k.kart).sort()).toEqual(['12', '30']);
  });
});
