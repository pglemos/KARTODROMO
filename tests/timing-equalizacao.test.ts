import { describe, expect, it } from 'vitest';
import { applyPassing, closeSession, createSession, startSession, type Session } from '../lib/timing/race-engine';
import { calcularEqualizacao, ultimaEqualizacaoPorKart, voltasNasBaterias } from '../lib/timing/equalizacao';
import { rankingKarts } from '../lib/timing/ranking-karts';

const BASE = Date.UTC(2026, 8, 3, 12, 30, 0); // 03/09/2026 09:30 em Brasília

/** Cria a sessão e aplica as voltas de cada kart (em ms), na ordem dada. */
function sessao(tipo: Session['type'], inicio: number, voltas: Record<string, number[]>, id = 'eq') {
  const s = createSession({ id, name: '', type: tipo, durationMin: 0, now: inicio, competitors: Object.keys(voltas).map((k) => ({ kart: k, name: `Piloto ${k}` })) });
  startSession(s, inicio);
  for (const [kart, tempos] of Object.entries(voltas)) {
    let t = inicio + 1_000;
    applyPassing(s, { kart, decoderTimeMs: t % 86_400_000, wallMs: t, transponder: Number(kart) * 100 });
    for (const lap of tempos) { t += lap; applyPassing(s, { kart, decoderTimeMs: t % 86_400_000, wallMs: t, transponder: Number(kart) * 100 }); }
  }
  return s;
}

// Matriz de exemplo da "Planilha Integrada de Gestão de Frota, Oficina e Equalização" (v3)
const PLANILHA = {
  '05': [52_380], '12': [52_410],
  '08': [53_120, 52_950, 52_680, 52_550, 52_435, 52_440],
  '23': [52_880, 52_700, 52_470, 52_480],
  '31': [52_600, 52_490, 52_350, 52_280, 52_210, 52_180, 52_410, 52_420],
  '19': [53_450, 53_200, 53_100, 52_990, 52_890],
};

describe('equalização dos karts', () => {
  it('a meta é a média das melhores voltas dos karts referência, com tolerância de 0,080 s', () => {
    const s = sessao('equalizacao', BASE, PLANILHA);
    s.equalizacao = { referencias: ['05', '12'] };
    const r = calcularEqualizacao(s);
    expect(r).toMatchObject({ metaMs: 52_395, metaOrigem: 'referencia', toleranciaMs: 80 });
    expect(r.karts.slice(0, 2).map((k) => [k.kart, k.status])).toEqual([['05', 'REF'], ['12', 'REF']]);
  });

  it('guarda os tempos de 2 em 2 voltas por redutor e vale o último bloco (como na planilha)', () => {
    const s = sessao('equalizacao', BASE, PLANILHA);
    s.equalizacao = { referencias: ['05', '12'] };
    const k = Object.fromEntries(calcularEqualizacao(s).karts.map((x) => [x.kart, x]));
    expect(k['08'].blocos.map((b) => [b.redutor, b.voltasMs])).toEqual([[0, [53_120, 52_950]], [1, [52_680, 52_550]], [2, [52_435, 52_440]]]);
    expect(k['08']).toMatchObject({ status: 'EQUALIZADO', redutorFinal: 2, acao: 'Instalar o redutor 2 e liberar' });
    expect(k['23']).toMatchObject({ status: 'EQUALIZADO', redutorFinal: 1 });
    // o 31 passou do ponto com os redutores 1 e 2 e só fechou com o 3
    expect(k['31'].blocos.map((b) => b.dentro)).toEqual([false, true, false, true]);
    expect(k['31']).toMatchObject({ status: 'EQUALIZADO', redutorFinal: 3 });
    // o 19 não chegou: enquanto aberta segue ajustando; a volta solta do 3º bloco ainda não conta
    expect(k['19']).toMatchObject({ status: 'AJUSTANDO', redutorFinal: 1 });
    expect(k['19'].blocos[2]).toMatchObject({ completo: false, voltasMs: [52_890] });
  });

  it('depois de finalizada, quem ficou fora da tolerância vai para revisão na oficina', () => {
    const s = sessao('equalizacao', BASE, PLANILHA);
    s.equalizacao = { referencias: ['05', '12'], finalizadaEm: BASE + 3_600_000 };
    const k19 = calcularEqualizacao(s).karts.find((x) => x.kart === '19')!;
    expect(k19.status).toBe('REVISAR');
    expect(k19.acao).toContain('encaminhar para a oficina');
  });

  it('kart referência não entra na regra das 2 voltas: todas as voltas valem para a meta', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_500, 52_380, 52_450, 52_400, 52_390], '12': [52_410, 52_600], '08': [52_400, 52_420] });
    s.equalizacao = { referencias: ['05', '12'] };
    const r = calcularEqualizacao(s);
    expect(r.referencias).toEqual([{ kart: '05', melhorMs: 52_380, mediaMs: 52_424, voltas: 5 }, { kart: '12', melhorMs: 52_410, mediaMs: 52_505, voltas: 2 }]);
    expect(r.karts.find((x) => x.kart === '05')!.blocos).toEqual([]);
    expect(r.karts.find((x) => x.kart === '08')).toMatchObject({ status: 'EQUALIZADO', redutorFinal: 0, acao: 'Liberado sem redutor' });
  });

  it('meta fixa do traçado, tolerância própria, redutor corrigido à mão e ação escrita pela oficina', () => {
    const s = sessao('equalizacao', BASE, { '08': [52_900, 52_880, 52_610, 52_590] });
    s.equalizacao = { metaModo: 'fixa', metaFixaMs: 52_500, toleranciaMs: 120, redutores: { '08': { '2': 3 } }, checklist: { '08': { acaoOficina: 'Trocar pneu DE', sistemas: { pneu: { status: 'atencao', nota: 'desgaste' } } } } };
    const r = calcularEqualizacao(s);
    expect(r).toMatchObject({ metaMs: 52_500, metaOrigem: 'fixa', toleranciaMs: 120 });
    expect(r.karts[0]).toMatchObject({ status: 'EQUALIZADO', redutorFinal: 3, acao: 'Trocar pneu DE' });
    expect(r.karts[0].blocos[1]).toMatchObject({ redutor: 3, mediaMs: 52_600, deltaMs: 100, dentro: true });
  });

  it('volta invalidada (saída de box) não entra nos blocos', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_400], '08': [70_000, 52_410, 52_420] });
    s.equalizacao = { referencias: ['05'] };
    s.competitors.find((c) => c.kart === '08')!.crossings[1].invalid = true;
    const k = calcularEqualizacao(s).karts.find((x) => x.kart === '08')!;
    expect(k.blocos).toHaveLength(1);
    expect(k.blocos[0].voltasMs).toEqual([52_410, 52_420]);
  });

  it('conta as voltas de cada kart nas baterias normais entre uma equalização e outra', () => {
    const eq1 = sessao('equalizacao', BASE, { '08': [52_400, 52_410] }, 'eq1'); closeSession(eq1, BASE + 600_000);
    const b1 = sessao('corrida', BASE + 3_600_000, { '08': [53_000, 53_100, 53_200], '09': [54_000] }, 'b1'); closeSession(b1, BASE + 4_200_000);
    const b2 = sessao('classificacao', BASE + 86_400_000, { '08': [53_000, 53_100] }, 'b2'); closeSession(b2, BASE + 86_400_000 + 600_000);
    const aberta = sessao('corrida', BASE + 90_000_000, { '08': [53_000] }, 'aberta');
    const todas = [eq1, b1, b2, aberta];
    const ultima = ultimaEqualizacaoPorKart(todas, BASE + 2 * 86_400_000);
    expect(ultima.get('08')).toBe(BASE + 600_000);
    const v = voltasNasBaterias(todas, ultima.get('08')!, BASE + 2 * 86_400_000, (k) => k);
    expect(v.get('08')).toEqual({ voltas: 5, baterias: 2 });
    expect(v.get('09')).toEqual({ voltas: 1, baterias: 1 });
  });

  it('os tempos da equalização ficam fora do ranking dos karts da cronometragem', () => {
    const eq = sessao('equalizacao', BASE, { '08': [40_000, 40_100] }, 'eq'); closeSession(eq, BASE + 600_000);
    const b = sessao('corrida', BASE + 3_600_000, { '08': [53_000, 53_100] }, 'b'); closeSession(b, BASE + 4_200_000);
    const opc = { de: null, ate: null, trackId: null, tipos: null };
    expect(rankingKarts([eq, b], opc, () => null, (k) => k)[0].melhorMs).toBe(53_000);
    expect(rankingKarts([eq, b], { ...opc, tipos: ['equalizacao'] }, () => null, (k) => k)[0].melhorMs).toBe(40_000);
  });
});
