import { describe, expect, it } from 'vitest';
import { applyPassing, closeSession, createSession, startSession, type Session } from '../lib/timing/race-engine';
import { regraDa, ajusteRedutorMm, calcularComAnteriores, retomarEqualizacao, calcularEqualizacao, faixasDaRegra, fmtTempoVolta, importarKarts, tempoVoltaParaMs, textoAjuste, ultimaEqualizacaoPorKart, voltasNasBaterias } from '../lib/timing/equalizacao';
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
  it('a meta é a melhor volta entre os karts referência (não a média); a regra padrão é a do Kart Indoor', () => {
    const s = sessao('equalizacao', BASE, PLANILHA);
    s.equalizacao = { referencias: ['05', '12'] };
    const r = calcularEqualizacao(s);
    expect(r).toMatchObject({ metaMs: 52_380, metaOrigem: 'referencia', toleranciaMs: 200, regra: { nome: 'Kart Indoor', toleranciaMs: 200, faixaMs: 200, passoMm: 0.1 } });
    expect(r.karts.slice(0, 2).map((k) => [k.kart, k.status])).toEqual([['05', 'REF'], ['12', 'REF']]);
  });

  it('a diferença para a referência diz quanto abrir ou fechar o redutor (a cada 0,2 s, 0,1 mm)', () => {
    const indoor = { toleranciaMs: 200, faixaMs: 200, passoMm: 0.1 };
    expect([0, 100, 200, 300, 400, 500, 700, 900].map((d) => ajusteRedutorMm(d, indoor))).toEqual([0, 0, 0, 0.1, 0.1, 0.2, 0.3, 0.4]);
    expect([-150, -300, -500, -1_100].map((d) => ajusteRedutorMm(d, indoor))).toEqual([0, -0.1, -0.2, -0.5]);
    expect([0, 0.2, -0.1].map(textoAjuste)).toEqual(['manter o redutor', 'abrir 0,2 mm', 'fechar 0,1 mm']);
    expect(faixasDaRegra(indoor, 4)).toEqual([{ deMs: 0, ateMs: 200, mm: 0 }, { deMs: 200, ateMs: 400, mm: 0.1 }, { deMs: 400, ateMs: 600, mm: 0.2 }, { deMs: 600, ateMs: 800, mm: 0.3 }]);
    // a faixa e o passo são editáveis: equalizado até 0,150 s; a cada 0,100 s, 0,05 mm
    const outra = { toleranciaMs: 150, faixaMs: 100, passoMm: 0.05 };
    expect([150, 151, 260, -360].map((d) => ajusteRedutorMm(d, outra))).toEqual([0, 0.05, 0.1, -0.15]);
  });

  it('a meta é digitada e mostrada como minutos:segundos:milésimos (há traçado de mais de um minuto)', () => {
    expect([74_000, 52_395, 61_005, 600_000].map(fmtTempoVolta)).toEqual(['01:14:000', '00:52:395', '01:01:005', '10:00:000']);
    expect(['01:14:000', '1:14:000', '00:52:395', '01:14:5', '1:14.250', '1:14,25', '74,000', '52.395'].map(tempoVoltaParaMs))
      .toEqual([74_000, 74_000, 52_395, 74_500, 74_250, 74_250, 74_000, 52_395]);
    expect(['', 'abc', '01:60:000', '1:2:3:4', '01:14:0000', '0', '00:00:000', '1:-5'].map(tempoVoltaParaMs)).toEqual([null, null, null, null, null, null, null, null]);
    expect(tempoVoltaParaMs(fmtTempoVolta(83_417))).toBe(83_417);
  });

  it('guarda os tempos de 2 em 2 voltas; cada bloco é o redutor sugerido no anterior e vale o último bloco', () => {
    const s = sessao('equalizacao', BASE, PLANILHA);
    s.equalizacao = { referencias: ['05', '12'] };
    const k = Object.fromEntries(calcularEqualizacao(s).karts.map((x) => [x.kart, x]));
    // 08: a melhor do bloco 1 ficou +0,570 s → abrir 0,2 mm; com 0,2 mm aberto a melhor já ficou +0,170 s (dentro)
    expect(k['08'].blocos.map((b) => [b.rotulo, b.voltasMs, b.melhorMs, b.ajusteMm])).toEqual([['inicial', [53_120, 52_950], 52_950, 0.2], ['+0,2 mm', [52_680, 52_550], 52_550, 0], ['+0,2 mm', [52_435, 52_440], 52_435, 0]]);
    expect(k['08']).toMatchObject({ status: 'EQUALIZADO', ajusteMm: 0, aberturaMm: 0.2, redutorSugerido: 'inicial + 0,2 mm', acao: 'Equalizado com o redutor aberto 0,2 mm em relação ao inicial: liberar' });
    expect(k['23']).toMatchObject({ status: 'EQUALIZADO', aberturaMm: 0.1 });
    // o 31 já estava dentro de 0,200 s com o redutor que tinha
    expect(k['31'].blocos.map((b) => b.dentro)).toEqual([true, true, true, true]);
    expect(k['31']).toMatchObject({ status: 'EQUALIZADO', aberturaMm: 0, redutorSugerido: 'inicial', acao: 'Equalizado com o redutor inicial: liberar' });
    // o 19 não chegou: abriu 0,4 mm e a melhor volta ainda está 0,610 s mais lenta; a volta solta do 3º bloco ainda não conta
    expect(k['19']).toMatchObject({ status: 'AJUSTANDO', ajusteMm: 0.3, aberturaMm: 0.7, redutorSugerido: 'inicial + 0,7 mm', acao: 'Abrir 0,3 mm: 0,610 s mais lento que a referência. Dar mais 2 voltas' });
    expect(k['19'].blocos[2]).toMatchObject({ completo: false, voltasMs: [52_890], aberturaMm: 0.7, ajusteMm: null });
  });

  it('compara a MELHOR volta do bloco com a meta, não a média (caso da pista em 02/10: uma volta lenta de propósito)', () => {
    // referência 21 com 1:03.427; o 46 fez 1:01.049 e uma volta de 2:06 — pela média dava "abrir 16,3 mm"
    const s = sessao('equalizacao', BASE, { '21': [63_691, 63_427], '35': [64_161, 63_970], '46': [61_049, 126_800] });
    s.equalizacao = { referencias: ['21'], toleranciaMs: 100 };
    const r = calcularEqualizacao(s);
    const k = Object.fromEntries(r.karts.map((x) => [x.kart, x]));
    expect(r.metaMs).toBe(63_427);
    expect(k['35'].blocos[0]).toMatchObject({ melhorMs: 63_970, mediaMs: 64_066, deltaMs: 543, ajusteMm: 0.3 });
    expect(k['35'].acao).toBe('Abrir 0,3 mm: 0,543 s mais lento que a referência. Dar mais 2 voltas');
    expect(k['46'].blocos[0]).toMatchObject({ melhorMs: 61_049, deltaMs: -2_378, ajusteMm: -1.2 });
    expect(k['46'].acao).toBe('Fechar 1,2 mm: 2,378 s mais rápido que a referência. Dar mais 2 voltas');
  });

  it('traz para a equalização os karts que andaram em outra bateria, sem mexer na origem nem em quem já tem voltas', () => {
    const origem = sessao('classificacao', BASE - 3_600_000, { '21': [63_861, 63_468], '60': [62_995, 62_493], '36': [67_420, 67_518], '99': [] }, 'origem');
    origem.competitors.find((c) => c.kart === '36')!.name = 'CHASSI 26';
    const eq = sessao('equalizacao', BASE, { '21': [63_690, 63_427] }, 'eq');
    eq.equalizacao = { referencias: ['21'], toleranciaMs: 100 };
    const r = importarKarts(eq, origem, ['60', '036', '21', '99', '77']);
    expect(r.importados).toEqual([{ kart: '60', piloto: 'Piloto 60', voltas: 2 }, { kart: '36', piloto: 'CHASSI 26', voltas: 2 }]);
    expect(r.ignorados).toEqual([{ kart: '21', motivo: 'já tem voltas na equalização' }, { kart: '99', motivo: 'sem volta nesta bateria' }, { kart: '77', motivo: 'sem volta nesta bateria' }]);
    expect(origem.competitors.find((c) => c.kart === '60')!.crossings).toHaveLength(3);
    const k = Object.fromEntries(calcularEqualizacao(eq).karts.map((x) => [x.kart, x]));
    expect(k['60'].blocos[0]).toMatchObject({ voltasMs: [62_995, 62_493], melhorMs: 62_493, deltaMs: -934 });
    expect(k['36']).toMatchObject({ piloto: 'CHASSI 26', status: 'AJUSTANDO' });
    expect(k['36'].blocos[0]).toMatchObject({ melhorMs: 67_420, deltaMs: 3_993 });
    // mexer na cópia não muda a bateria de origem
    eq.competitors.find((c) => c.kart === '60')!.crossings[1].deleted = true;
    expect(origem.competitors.find((c) => c.kart === '60')!.crossings[1].deleted).toBeUndefined();
  });

  it('nova equalização começa sem blocos nem pendências herdadas e mantém cada sessão no seu histórico', () => {
    const DIA = 86_400_000;
    const eq1 = sessao('equalizacao', BASE, { '21': [63_690, 63_427], '35': [64_161, 63_970] }, 'eq1');
    eq1.equalizacao = { referencias: ['21'], toleranciaMs: 100, checklist: { '35': { sistemas: { motor: { status: 'atencao', nota: 'falha em alta' } } } } };
    closeSession(eq1, BASE + 3_600_000);
    const historico = calcularComAnteriores(eq1, [eq1]).karts.find((k) => k.kart === '35')!;
    expect(historico).toMatchObject({ status: 'REVISAR', blocos: [{ bloco: 1, voltasMs: [64_161, 63_970] }] });

    // O mesmo kart foi escolhido para a nova sessão, mas ainda não deu voltas nela.
    const eq2 = sessao('equalizacao', BASE + DIA, { '21': [63_600, 63_500], '35': [] }, 'eq2');
    eq2.equalizacao = { referencias: ['21'], toleranciaMs: 100 };
    const atual = Object.fromEntries(calcularComAnteriores(eq2, [eq1, eq2]).karts.map((k) => [k.kart, k]));
    expect(atual['35']).toMatchObject({ status: 'SEM VOLTAS', blocos: [], checklist: null });
    expect(atual['35'].pendenteDe).toBeNull();
    expect(atual['21'].blocos).toHaveLength(1);

    // Quando ele anda, as voltas desta sessão entram no bloco 1 com o redutor inicial dela.
    const com35 = sessao('equalizacao', BASE + DIA, { '21': [63_600, 63_500], '35': [63_700, 63_560] }, 'eq2-com-voltas');
    com35.equalizacao = { referencias: ['21'], toleranciaMs: 100 };
    const medicaoNova = calcularComAnteriores(com35, [eq1, com35]).karts.find((k) => k.kart === '35')!;
    expect(medicaoNova.blocos.map((b) => [b.bloco, b.rotulo, b.voltasMs, b.anteriorEm])).toEqual([[1, 'inicial', [63_700, 63_560], undefined]]);
    expect(calcularComAnteriores(eq1, [eq1, eq2, com35]).karts.find((k) => k.kart === '35')).toMatchObject({ status: 'REVISAR', blocos: [{ bloco: 1, voltasMs: [64_161, 63_970] }] });
  });

  it('não traz pendências nem do mesmo traçado nem de outro traçado', () => {
    const DIA = 86_400_000;
    const anteriorMesmoTracado = sessao('equalizacao', BASE, { '21': [63_690, 63_427], '35': [64_161, 63_970] }, 'eq-mesmo-tracado');
    anteriorMesmoTracado.trackId = 'tracado-11';
    anteriorMesmoTracado.equalizacao = { referencias: ['21'] };
    closeSession(anteriorMesmoTracado, BASE + 3_600_000);

    const anteriorOutroTracado = sessao('equalizacao', BASE + DIA, { '21': [63_600, 63_500], '60': [64_100, 63_900] }, 'eq-outro-tracado');
    anteriorOutroTracado.trackId = 'tracado-12';
    anteriorOutroTracado.equalizacao = { referencias: ['21'] };
    closeSession(anteriorOutroTracado, BASE + DIA + 3_600_000);

    const atual = sessao('equalizacao', BASE + 2 * DIA, { '21': [63_600, 63_500] }, 'eq-atual');
    atual.trackId = 'tracado-11';
    atual.equalizacao = { referencias: ['21'] };

    const resultado = calcularComAnteriores(atual, [anteriorMesmoTracado, anteriorOutroTracado, atual]);
    const karts = new Map(resultado.karts.map((kart) => [kart.kart, kart]));
    expect(karts.has('35')).toBe(false);
    expect(karts.has('60')).toBe(false);
  });

  it('nova equalização reinicia também os blocos da referência no mesmo dia e traçado', () => {
    const DIA = 86_400_000;
    const dia = BASE + 29 * DIA; // 02/10/2026 em Brasília
    const diaAnterior = sessao('equalizacao', dia - DIA, { '21': [62_100, 62_000] }, 'eq-dia-anterior');
    diaAnterior.trackId = 'tracado-11';
    diaAnterior.equalizacao = { referencias: ['21'] };
    closeSession(diaAnterior, dia - DIA + 3_600_000);

    const outroTracado = sessao('equalizacao', dia + 10 * 60_000, { '21': [61_100, 61_000] }, 'eq-outro-tracado');
    outroTracado.trackId = 'tracado-12';
    outroTracado.equalizacao = { referencias: ['21'] };
    closeSession(outroTracado, dia + 70 * 60_000);

    const anterior = sessao('equalizacao', dia + 90 * 60_000, { '21': [63_691, 63_427] }, 'eq-ref-anterior');
    anterior.trackId = 'tracado-11';
    anterior.chuva = true;
    anterior.equalizacao = { referencias: ['21'] };
    closeSession(anterior, dia + 150 * 60_000);

    const atual = sessao('equalizacao', dia + 180 * 60_000, { '21': [64_065, 64_453] }, 'eq-ref-atual');
    atual.trackId = 'tracado-11';
    atual.chuva = false;
    atual.equalizacao = { referencias: ['21'] };

    const resultado = calcularComAnteriores(atual, [diaAnterior, outroTracado, anterior, atual]);
    const referencia = resultado.karts.find((k) => k.kart === '21')!;

    expect(resultado.metaMs).toBe(64_065); // a meta continua usando somente as voltas da equalização atual
    expect(referencia).toMatchObject({ referencia: true, status: 'REF', melhorMs: 64_065, mediaMs: 64_259 });
    expect(referencia.blocos.map((b) => [b.bloco, b.voltasMs, b.melhorMs, b.mediaMs, b.anteriorEm])).toEqual([[1, [64_065, 64_453], 64_065, 64_259, undefined]]);
  });

  it('registra equalização manual após o ajuste aplicado, sem inventar voltas de confirmação', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_380], '08': [51_940, 51_950] });
    s.equalizacao = { referencias: ['05'], checklist: { '08': {
      confirmacaoManual: { aberturaMm: -0.2, bloco: 1, confirmadoEm: BASE + 300_000, autor: 'Oficina' },
    } } };
    const kart = calcularEqualizacao(s).karts.find((k) => k.kart === '08')!;
    expect(kart.blocos).toHaveLength(1);
    expect(kart.blocos[0]).toMatchObject({ completo: true, ajusteMm: -0.2 });
    expect(kart).toMatchObject({ status: 'EQUALIZADO', confirmadoManualmente: true, ajusteMm: 0,
      aberturaMm: -0.2, redutorSugerido: 'inicial − 0,2 mm' });
    expect(kart.acao).toContain('manualmente');
  });

  it('uma nova medição completa substitui a confirmação manual antiga', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_380], '08': [51_940, 51_950, 52_150, 52_170] });
    s.equalizacao = { referencias: ['05'], checklist: { '08': {
      confirmacaoManual: { aberturaMm: -0.2, bloco: 1, confirmadoEm: BASE + 300_000, autor: 'Oficina' },
    } } };
    const kart = calcularEqualizacao(s).karts.find((k) => k.kart === '08')!;
    expect(kart.blocos).toHaveLength(2);
    expect(kart.confirmadoManualmente).toBe(false);
    expect(kart.status).toBe('AJUSTANDO');
  });

  it('kart mais rápido que a referência: a sugestão é fechar o redutor', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_380], '12': [52_410], '08': [52_000, 52_010, 52_150, 52_170] });
    s.equalizacao = { referencias: ['05', '12'] };
    const k = calcularEqualizacao(s).karts.find((x) => x.kart === '08')!;
    expect(k.blocos.map((b) => [b.rotulo, b.deltaMs, b.ajusteMm])).toEqual([['inicial', -380, -0.1], ['−0,1 mm', -230, -0.1]]);
    expect(k).toMatchObject({ status: 'AJUSTANDO', ajusteMm: -0.1, aberturaMm: -0.2, redutorSugerido: 'inicial − 0,2 mm', acao: 'Fechar 0,1 mm: 0,230 s mais rápido que a referência. Dar mais 2 voltas' });
  });

  it('depois de finalizada, quem ficou fora da tolerância vai para revisão na oficina', () => {
    const s = sessao('equalizacao', BASE, PLANILHA);
    s.equalizacao = { referencias: ['05', '12'], finalizadaEm: BASE + 3_600_000 };
    const k19 = calcularEqualizacao(s).karts.find((x) => x.kart === '19')!;
    expect(k19.status).toBe('REVISAR');
    expect(k19.acao).toBe('Não chegou na meta: 0,610 s mais lento que a referência (faltou abrir 0,3 mm). Encaminhar para a oficina');
  });

  it('a volta ruim de um kart referência (motor falhando, saída de box) não puxa a meta: vale só a melhor', () => {
    const s = sessao('equalizacao', BASE, { '05': [58_900, 52_700, 52_380, 55_100], '12': [60_200, 52_410], '14': [61_000] });
    s.equalizacao = { referencias: ['05', '12', '14'] };
    const r = calcularEqualizacao(s);
    expect(r.metaMs).toBe(52_380);
    expect(r.referencias.map((x) => [x.kart, x.melhorMs])).toEqual([['05', 52_380], ['12', 52_410], ['14', 61_000]]);
  });

  it('kart referência não entra na regra das 2 voltas: todas as voltas valem para a meta', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_500, 52_380, 52_450, 52_400, 52_390], '12': [52_410, 52_600], '08': [52_400, 52_420] });
    s.equalizacao = { referencias: ['05', '12'] };
    const r = calcularEqualizacao(s);
    expect(r.referencias).toEqual([{ kart: '05', melhorMs: 52_380, mediaMs: 52_424, voltas: 5 }, { kart: '12', melhorMs: 52_410, mediaMs: 52_505, voltas: 2 }]);
    expect(r.karts.find((x) => x.kart === '05')!.blocos[0]).toMatchObject({ bloco: 1, voltasMs: [52_500, 52_380, 52_450, 52_400, 52_390], melhorMs: 52_380, mediaMs: 52_424, rotulo: 'referência' });
    expect(r.karts.find((x) => x.kart === '08')).toMatchObject({ status: 'EQUALIZADO', aberturaMm: 0, acao: 'Equalizado com o redutor inicial: liberar' });
  });

  it('meta fixa do traçado, tolerância própria, redutor corrigido à mão, medida do inicial e ação escrita pela oficina', () => {
    const s = sessao('equalizacao', BASE, { '08': [52_900, 52_880, 52_610, 52_590], '09': [52_900, 52_880] });
    s.equalizacao = {
      metaModo: 'fixa', metaFixaMs: 52_500, toleranciaMs: 120, regraNome: 'Kart Pro', aberturas: { '08': { '2': 0.3 } }, redutorInicialMm: { '08': 17, '09': 17.5 },
      checklist: { '08': { acaoOficina: 'Trocar pneu DE', sistemas: { pneu: { status: 'atencao', nota: 'desgaste' } } } },
    };
    const r = calcularEqualizacao(s);
    expect(r).toMatchObject({ metaMs: 52_500, metaOrigem: 'fixa', toleranciaMs: 120, regra: { nome: 'Kart Pro', faixaMs: 200, passoMm: 0.1 } });
    // a regra mandava abrir 0,2 mm (+0,380 s com tolerância de 0,120); a oficina abriu 0,3 mm e anotou
    expect(r.karts[0].blocos.map((b) => [b.rotulo, b.redutorMm, b.ajusteMm])).toEqual([['17,0 mm', 17, 0.2], ['17,3 mm', 17.3, 0]]);
    expect(r.karts[0]).toMatchObject({ status: 'EQUALIZADO', aberturaMm: 0.3, redutorMm: 17.3, redutorSugerido: '17,3 mm', acao: 'Trocar pneu DE' });
    expect(r.karts[0].blocos[1]).toMatchObject({ aberturaMm: 0.3, melhorMs: 52_590, mediaMs: 52_600, deltaMs: 90, dentro: true });
    // com a medida do redutor inicial, a sugestão já sai na medida real
    expect(r.karts[1]).toMatchObject({ status: 'AJUSTANDO', redutorSugerido: '17,7 mm', acao: 'Abrir 0,2 mm (redutor 17,7 mm): 0,380 s mais lento que a meta. Dar mais 2 voltas' });
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

  it('retomar a equalização encerrada continua a mesma: voltas novas entram nos blocos seguintes (áudio 06/10)', () => {
    const s = sessao('equalizacao', BASE, { '05': [52_380, 52_400], '08': [53_000, 52_900] });
    s.equalizacao = { referencias: ['05'] };
    s.state = 'bandeira_final';
    for (const c of s.competitors) c.finished = true; // levaram a quadriculada
    closeSession(s, BASE + 200_000);
    expect(s.state).toBe('encerrada');
    expect(calcularEqualizacao(s).karts.find((k) => k.kart === '08')!.blocos).toHaveLength(1);

    expect(retomarEqualizacao(s)).toBe(true);
    expect(s).toMatchObject({ state: 'em_andamento', currentFlag: 'green', finishedAt: null, checkeredAt: null });
    expect(s.competitors.every((c) => !c.finished)).toBe(true);

    // 40 min depois (outra bateria no meio): a 1ª volta sai longa, como a saída do box; a 2ª é a que vale
    let t = BASE + 40 * 60_000;
    for (const lap of [0, 52_500]) { t += lap; applyPassing(s, { kart: '08', decoderTimeMs: t % 86_400_000, wallMs: t, transponder: 800 }); }
    const k08 = calcularEqualizacao(s).karts.find((k) => k.kart === '08')!;
    expect(k08.blocos.map((b) => b.bloco)).toEqual([1, 2]);
    expect(k08.blocos[1]).toMatchObject({ completo: true, melhorMs: 52_500 });
    expect(retomarEqualizacao(s)).toBe(false); // já está aberta
  });

  it('não retoma o que não é equalização encerrada', () => {
    const corrida = sessao('corrida', BASE, { '05': [52_000] }, 'c');
    closeSession(corrida, BASE + 60_000);
    expect(() => retomarEqualizacao(corrida)).toThrow(/Só equalização/);
    const nova = createSession({ id: 'p', name: '', type: 'equalizacao', durationMin: 0, now: BASE, competitors: [] });
    expect(() => retomarEqualizacao(nova)).toThrow(/ainda não largou/);
  });
});

describe('regra do redutor com 2 faixas (pedido de 07/10: até 2 s e acima de 2 s)', () => {
  // até 2 s: a cada 0,200 s, 0,1 mm (Kart Indoor); acima de 2 s: a cada 0,500 s, mais 0,1 mm
  const duas = { toleranciaMs: 200, faixaMs: 200, passoMm: 0.1, limiteMs: 2000, faixa2Ms: 500, passo2Mm: 0.1 };
  it('até o limite é igual à regra de uma faixa', () => {
    expect([0, 200, 300, 1000, 2000].map((d) => ajusteRedutorMm(d, duas))).toEqual([0, 0, 0.1, 0.4, 0.9]);
  });
  it('acima do limite soma a 2ª faixa ao que a 1ª dá no limite (sem salto)', () => {
    expect([2001, 2500, 2501, 3000, 3001].map((d) => ajusteRedutorMm(d, duas))).toEqual([1, 1, 1.1, 1.1, 1.2]);
    expect(ajusteRedutorMm(-2600, duas)).toBe(-1.1); // mais rápido: fechar, mesma conta
  });
  it('sem limite (ou incompleta) continua uma faixa só', () => {
    expect(ajusteRedutorMm(3000, { toleranciaMs: 200, faixaMs: 200, passoMm: 0.1 })).toBe(1.4);
    expect(regraDa({ toleranciaMs: 200, faixaMs: 200, passoMm: 0.1, limiteMs: 2000, faixa2Ms: null, passo2Mm: 0.1 })).toMatchObject({ limiteMs: null, faixa2Ms: null, passo2Mm: null });
    expect(regraDa({ toleranciaMs: 200, faixaMs: 200, passoMm: 0.1, limiteMs: 2000, faixa2Ms: 500, passo2Mm: 0.2 })).toMatchObject({ limiteMs: 2000, faixa2Ms: 500, passo2Mm: 0.2 });
  });
  it('as faixas do relatório mostram a 1ª até o limite e depois a 2ª', () => {
    const fx = faixasDaRegra({ ...duas, faixaMs: 600, passoMm: 0.2 }, 6);
    expect(fx).toEqual([
      { deMs: 0, ateMs: 200, mm: 0 }, { deMs: 200, ateMs: 800, mm: 0.2 }, { deMs: 800, ateMs: 1400, mm: 0.4 }, { deMs: 1400, ateMs: 2000, mm: 0.6 },
      { deMs: 2000, ateMs: 2500, mm: 0.7, segunda: true }, { deMs: 2500, ateMs: 3000, mm: 0.8, segunda: true },
    ]);
  });
});
