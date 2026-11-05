import { describe, it, expect } from 'vitest';
import { createSession, addPenalty, removePenalty, computeStandings, startSession, applyPassing, recuperarVoltas, marcarPassagemManual, aplicarLargadaUltimo, setCompetitors, ajustarPosicaoComVoltas } from '../lib/timing/race-engine';
const sessao = () => createSession({ id: 'teste', name: 'TESTE CODEX', type: 'corrida', durationMin: 20, now: 0, competitors: [{ kart: '1', name: 'Ana', customerId: 'a' }, { kart: '2', name: 'Bia', customerId: 'b' }, { kart: '3', name: 'Cid', customerId: 'c' }] });
const punir = (s: ReturnType<typeof sessao>, infracao: string, id = 'p') => addPenalty(s, '1', { id, tipo: 'advertencia', infracao, wallMs: 1000 });
describe('ajustes operacionais', () => {
  it.each(['levantar', 'contramao'])('%s desclassifica automaticamente e retirada restaura', (infracao) => {
    const s = sessao(); punir(s, infracao);
    const classificacao = computeStandings(s);
    expect(classificacao[classificacao.length - 1]).toMatchObject({ kart: '1', desclassificado: true });
    removePenalty(s, '1', 'p'); expect(computeStandings(s)[0].desclassificado).toBe(false);
  });
  it('capacete termina atrás dos classificados e antes dos desclassificados, inclusive após posição manual', () => {
    const s = sessao(); punir(s, 'capacete'); s.competitors[2].flag = 'black'; s.manualPositions = { '1': 1 };
    expect(computeStandings(s).map(x => x.kart)).toEqual(['2', '1', '3']);
  });
  it('somente o terceiro alerta de pilotagem perigosa desclassifica; id repetido não duplica', () => {
    const s = sessao(); punir(s, 'perigosa', '1'); punir(s, 'perigosa', '1');
    expect(s.competitors[0].penalidades).toHaveLength(1);
    punir(s, 'perigosa', '2'); expect(computeStandings(s).find(x => x.kart === '1')?.desclassificado).toBe(false);
    punir(s, 'perigosa', '3'); expect(computeStandings(s).find(x => x.kart === '1')?.desclassificado).toBe(true);
  });
  it('infração inválida é recusada', () => expect(() => punir(sessao(), 'inventada')).toThrow());
  it('último na tomada altera somente a corrida vinculada e preparada', () => {
    const t = sessao(); t.type = 'classificacao'; t.programaId = 'grupo';
    const c = sessao(); c.id = 'corrida'; c.programaId = 'grupo';
    punir(t, 'largar-ultimo'); aplicarLargadaUltimo(t, c);
    expect(c.competitors.map(x => x.customerId)).toEqual(['b', 'c', 'a']);
    startSession(c, 1000); expect(() => aplicarLargadaUltimo(t, c)).toThrow();
  });
  it('recupera voltas correspondentes do kart à frente, auditadas como estimadas', () => {
    const s = sessao(); startSession(s, 1000);
    for (const [i, ms] of [1000, 61000, 122000].entries()) applyPassing(s, { id: `r${i}`, kart: '2', wallMs: ms, decoderTimeMs: ms });
    applyPassing(s, { id: 'a', kart: '1', wallMs: 1001, decoderTimeMs: 1001 });
    recuperarVoltas(s, { kart: '1', referencia: '2', quantidade: 2, posicao: 2, now: 130000, id: 'op' });
    expect(s.competitors[0].crossings.slice(1).map(x => x.lapMs)).toEqual([60000, 61000]);
    expect(s.competitors[0].crossings.slice(1).every(x => x.estimada)).toBe(true);
    expect(computeStandings(s).find(x => x.kart === '1')?.bestLapMs).toBeNull();
  });
  it('referência insuficiente não insere parcialmente nem inventa tempos', () => {
    const s = sessao(); startSession(s, 1000);
    expect(() => recuperarVoltas(s, { kart: '1', referencia: '2', quantidade: 2, posicao: 2, now: 130000, id: 'op' })).toThrow();
    expect(s.competitors[0].crossings).toHaveLength(0);
  });
  it('toque manual calcula intervalo desde a passagem anterior e rejeita toque duplicado', () => {
    const s = sessao(); startSession(s, 1000);
    marcarPassagemManual(s, '1', 2000, 'm1'); marcarPassagemManual(s, '1', 62000, 'm2');
    expect(s.competitors[0].crossings[1].lapMs).toBe(60000);
    expect(() => marcarPassagemManual(s, '1', 62001, 'm3')).toThrow();
  });
});

import { calcularEqualizacao, compararHistorico } from '../lib/timing/equalizacao';
describe('equalização operacional', () => {
 it('confirma sem teste sem exigir bloco completo e identifica explicitamente', () => {
   const s = sessao(); s.type = 'equalizacao'; s.equalizacao = { checklist: { '1': { confirmacaoManual: { aberturaMm: 1, bloco: 0, confirmadoEm: 1000, autor: 'TESTE CODEX', semTeste: true, voltasNaConfirmacao: 0 } } } };
   expect(calcularEqualizacao(s).karts.find(x => x.kart === '1')).toMatchObject({ status: 'EQUALIZADO', confirmadoManualmente: true });
   expect(calcularEqualizacao(s).karts.find(x => x.kart === '1')?.acao).toMatch(/não testado/);
 });
 it('compara até cinco tempos reais dos últimos quinze dias, sem manuais, estimados ou futuros', () => {
   const s = sessao(); const now = 20 * 86400000;
   s.competitors[0].crossings = Array.from({ length: 9 }, (_, i) => ({ id: String(i), wallMs: now - (i + 1) * 100000, decoderTimeMs: i * 60000, lapMs: i ? 60000 + i : null, source: 'decoder' as const }));
   s.competitors[0].crossings[1].estimada = true; s.competitors[0].crossings[2].source = 'manual';
   const r = compararHistorico([s], { kart: '1', referencia: '2', now });
   expect(r.kart.voltas).toHaveLength(5); expect(r.kart.voltas[0].lapMs).toBe(60003);
   expect(() => compararHistorico([s], { kart: '1', referencia: '101', now })).toThrow();
 });
 it('duas frotas usam referências e regras próprias simultaneamente', () => {
   const s = sessao(); s.type = 'equalizacao'; s.competitors.push({ ...s.competitors[0], kart: '101', name: 'Super ref', crossings: [] }, { ...s.competitors[1], kart: '102', name: 'Super teste', crossings: [] });
   for (const c of s.competitors) c.crossings = [0, 60000, 120000].map((t, i) => ({ wallMs: t, decoderTimeMs: t, lapMs: i ? (Number(c.kart) >= 100 ? 65000 : 60000) : null }));
   s.equalizacao = { frotas: { LIGHT: { referencias: ['1'], toleranciaMs: 100, faixaMs: 100, passoMm: 0.1 }, SUPER: { referencias: ['101'], toleranciaMs: 200, faixaMs: 200, passoMm: 0.2 } } };
   const r = calcularEqualizacao(s); expect(r.frotas?.LIGHT?.metaMs).toBe(60000); expect(r.frotas?.SUPER?.metaMs).toBe(65000);
   expect(r.karts.find(x => x.kart === '102')?.metaMs).toBe(65000);
 });
});

it('punição de grid resiste à sincronização dos competidores e a retirada restaura a ordem anterior', () => {
 const t = sessao(); t.type = 'classificacao'; t.programaId = 'p'; const c = sessao(); c.id = 'c'; c.programaId = 'p';
 punir(t, 'largar-ultimo'); aplicarLargadaUltimo(t, c);
 setCompetitors(c, [{ kart: '1', name: 'Ana', customerId: 'a' }, { kart: '2', name: 'Bia', customerId: 'b' }, { kart: '3', name: 'Cid', customerId: 'c' }]);
 startSession(c, 1000); expect(c.competitors[c.competitors.length - 1]?.customerId).toBe('a');
 c.state = 'preparando'; removePenalty(t, '1', 'p'); aplicarLargadaUltimo(t, c);
 expect(c.competitors.map(x => x.customerId)).toEqual(['a', 'b', 'c']);
});

it('voltas recuperadas ficam atrás do kart de referência mesmo com largada anterior', () => {
 const s = sessao(); startSession(s, 1000);
 applyPassing(s, { id: 'a', kart: '1', wallMs: 1000, decoderTimeMs: 1000 });
 for (const [i, ms] of [6000, 66000, 127000].entries()) applyPassing(s, { id: `r${i}`, kart: '2', wallMs: ms, decoderTimeMs: ms });
 recuperarVoltas(s, { kart: '1', referencia: '2', quantidade: 2, posicao: 2, now: 130000, id: 'op' });
 expect(s.competitors[0].crossings[s.competitors[0].crossings.length - 1]?.wallMs).toBe(127001);
 expect(s.competitors[0].crossings.slice(1).map(x => x.lapMs)).toEqual([60000, 61000]);
});

it('ajuste manual de posição preserva as voltas recuperadas do sensor', () => {
 const s = sessao(); startSession(s, 1000);
 for (const [i, ms] of [1000, 61000, 122000].entries()) applyPassing(s, { id: `ref-${i}`, kart: '2', wallMs: ms, decoderTimeMs: ms });
 applyPassing(s, { id: 'inicio-1', kart: '1', wallMs: 1001, decoderTimeMs: 1001 });
 recuperarVoltas(s, { kart: '1', referencia: '2', quantidade: 2, posicao: 2, now: 130000, id: 'recuperacao' });
 ajustarPosicaoComVoltas(s, '1', 1);
 expect(s.competitors.find(c => c.kart === '1')?.crossings.filter(x => x.referenciaPassagem).map(x => x.id)).toEqual(['recuperacao-0', 'recuperacao-1']);
});

it('fallback de posição coloca a última volta estimada depois do kart de referência', () => {
 const s = sessao(); startSession(s, 1000); s.startedAt = 1000; s.minLapMs = 60000;
 const passagem = (id: string, wallMs: number, lapMs: number | null) => ({ id, wallMs, decoderTimeMs: wallMs % 86400000, lapMs, source: 'decoder' as const });
 s.competitors.find(c => c.kart === '1')!.crossings = [passagem('a0', 1001, null)];
 s.competitors.find(c => c.kart === '2')!.crossings = [passagem('b0', 1000, null), ...[31000, 61000, 91000].map((t, i) => passagem(`b${i + 1}`, t, 30000))];
 s.competitors.find(c => c.kart === '3')!.crossings = [passagem('c0', 1002, null), ...[31002, 61002, 91002].map((t, i) => passagem(`c${i + 1}`, t, 30000))];
 ajustarPosicaoComVoltas(s, '1', 2);
 const voltasReferencia = s.competitors.find(c => c.kart === '2')!.crossings;
 const referencia = voltasReferencia[voltasReferencia.length - 1]!.wallMs;
 const estimadas = s.competitors.find(c => c.kart === '1')!.crossings.filter(x => x.estimada);
 expect(estimadas).toHaveLength(3);
 expect(estimadas[estimadas.length - 1]!.wallMs).toBeGreaterThan(referencia);
});

it('busca o kart da posição anterior em cada volta mesmo quando os pilotos trocam de posição', () => {
 const s = sessao(); startSession(s, 1000);
 applyPassing(s, { id: 'a', kart: '1', wallMs: 1000, decoderTimeMs: 1000 });
 for (const [kart, tempos] of [['2', [1000, 61000, 126000]], ['3', [1000, 62000, 125000]]] as const) for (const [i, wallMs] of tempos.entries()) applyPassing(s, { id: `${kart}-${i}`, kart, wallMs, decoderTimeMs: wallMs });
 recuperarVoltas(s, { kart: '1', referencia: '3', quantidade: 2, posicao: 2, now: 130000, id: 'op' });
 expect(s.competitors[0].crossings.slice(1).map(x => [x.lapMs, x.referenciaKart])).toEqual([[60000, '2'], [63000, '3']]);
});

it('tomada de tempo: kart subido manualmente para o 3o lugar ganha as voltas que faltam', () => {
  const s = createSession({ id: 'tt', name: 'TOMADA', type: 'classificacao', durationMin: 5, now: 0, competitors: [{ kart: '1', name: 'Ana', customerId: 'a' }, { kart: '2', name: 'Bia', customerId: 'b' }, { kart: '3', name: 'Cid', customerId: 'c' }, { kart: '4', name: 'Duda', customerId: 'd' }] });
  startSession(s, 1000);
  const tempos: Record<string, number[]> = { '1': [1000, 61000, 121000, 181000, 241000], '2': [1001, 62000, 123000, 184000, 245000], '3': [1002, 63000, 124000, 185000], '4': [] };
  for (const [kart, ts] of Object.entries(tempos)) for (const [i, wallMs] of ts.entries()) applyPassing(s, { id: `${kart}-${i}`, kart, wallMs, decoderTimeMs: wallMs });
  const { voltasAdicionadas } = ajustarPosicaoComVoltas(s, '4', 3);
  const lapsDe = (k: string) => computeStandings(s, 1000).find((r) => r.kart === k)!.laps;
  expect(voltasAdicionadas).toBeGreaterThan(0);
  expect(computeStandings(s, 1000).find((r) => r.kart === '4')!.position).toBe(3);
  expect(lapsDe('4')).toBe(lapsDe('2'));
});
