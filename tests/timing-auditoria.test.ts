/** Regressões da auditoria da cronometragem (06/10/2026): cada bloco é um achado confirmado no código. */
import { describe, expect, it } from 'vitest';
import {
  addPenalty, applyPassing, closeSession, computeStandings, createSession, elapsedMs, includeManualPassing,
  setCompetitors, setRaceFlag, startSession, swapKart, type Session,
} from '../lib/timing/race-engine';
import { importarKarts } from '../lib/timing/equalizacao';
import { usoKartsDaSessao } from '../lib/timing/kart-fisico';
import { createCatalogRecord, emptyCatalog, normalizeCatalog, updateCatalogRecord } from '../lib/timing/catalog';
import { ListaMudouError, competidoresComSorteio, validarSorteio } from '../lib/timing/sorteio';
import { CONFIG_PADRAO, montarConfig } from '../services/timing-email';

const T0 = 1_760_000_000_000;
let seq = 0;
const passa = (s: Session, kart: string, wallMs: number) =>
  applyPassing(s, { id: `p${++seq}`, kart, decoderTimeMs: wallMs % 86_400_000, wallMs, transponder: Number(kart), source: 'decoder' });

function corrida(competitors: { kart: string; name: string; customerId?: string }[]) {
  const s = createSession({ id: 's1', name: 'Bateria 20:00 · CORRIDA', type: 'corrida', durationMin: 10, minLapSec: 5, now: T0, competitors });
  startSession(s, T0);
  return s;
}

describe('F02 · editar a lista não apaga advertências e penalidades', () => {
  it('salvar a lista igual, trocar nome e excluir outro piloto mantém PEN e ADV', () => {
    const s = corrida([{ kart: '4', name: 'Ana', customerId: '1' }, { kart: '5', name: 'Bia', customerId: '2' }, { kart: '6', name: 'Cid', customerId: '3' }]);
    for (const k of ['4', '5', '6']) passa(s, k, T0 + 1000);
    passa(s, '4', T0 + 61_000); passa(s, '5', T0 + 62_000); passa(s, '6', T0 + 63_000);
    addPenalty(s, '4', { id: 'pen', tipo: 'tempo', segundos: 5, wallMs: T0 + 70_000 });
    addPenalty(s, '5', { id: 'adv', tipo: 'advertencia', wallMs: T0 + 70_000 });
    expect(computeStandings(s).map((r) => r.kart)).toEqual(['5', '6', '4']);

    setCompetitors(s, s.competitors.map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId })));
    expect(s.competitors.find((c) => c.kart === '4')?.penalidades?.[0]?.segundos).toBe(5);
    expect(s.competitors.find((c) => c.kart === '5')?.penalidades?.[0]?.tipo).toBe('advertencia');

    setCompetitors(s, [{ kart: '4', name: 'Ana Souza', customerId: '1' }, { kart: '5', name: 'Bia', customerId: '2' }]);
    const st = computeStandings(s);
    expect(st.map((r) => r.kart)).toEqual(['5', '4']);
    expect(st.find((r) => r.kart === '4')?.penaltyMs).toBe(5000);
    expect(st.find((r) => r.kart === '5')?.advertencias).toBe(1);
  });

  it('a penalidade segue o piloto na troca de kart', () => {
    const s = corrida([{ kart: '4', name: 'Ana', customerId: '1' }]);
    passa(s, '4', T0 + 1000); passa(s, '4', T0 + 61_000);
    addPenalty(s, '4', { id: 'pen', tipo: 'tempo', segundos: 3, wallMs: T0 + 62_000 });
    swapKart(s, { fromKart: '4', toKart: '9', customerId: '1' });
    expect(s.competitors.find((c) => c.kart === '9')?.penalidades?.map((p) => p.id)).toEqual(['pen']);
  });
});

describe('F08 · volta manual depois da quadriculada é a chegada', () => {
  it('fecha o piloto: a leitura seguinte do decoder não conta', () => {
    const s = corrida([{ kart: '4', name: 'Ana' }]);
    passa(s, '4', T0 + 1000);
    setRaceFlag(s, 'checkered', T0 + 50_000);
    includeManualPassing(s, { id: 'm1', kart: '4', lapMs: 60_000, wallMs: T0 + 61_000 });
    expect(s.competitors[0].finished).toBe(true);
    expect(passa(s, '4', T0 + 121_000)).toBe('ignored-finished');
    expect(computeStandings(s)[0].laps).toBe(1);
  });
});

describe('F26 · encerrar na vermelha', () => {
  it('a duração final fica congelada na vermelha', () => {
    const s = corrida([{ kart: '4', name: 'Ana' }]);
    passa(s, '4', T0 + 2000);
    setRaceFlag(s, 'red', T0 + 64_000);
    closeSession(s, T0 + 124_000);
    expect(elapsedMs(s, T0 + 999_000)).toBe(62_000);
  });
  it('sem vermelha e com vermelha retomada continua igual', () => {
    const a = corrida([{ kart: '4', name: 'Ana' }]);
    passa(a, '4', T0 + 2000);
    closeSession(a, T0 + 124_000);
    expect(elapsedMs(a, T0 + 999_000)).toBe(122_000);

    const b = corrida([{ kart: '4', name: 'Ana' }]);
    passa(b, '4', T0 + 2000);
    setRaceFlag(b, 'red', T0 + 64_000);
    setRaceFlag(b, 'green', T0 + 94_000); // 30 s parada
    closeSession(b, T0 + 124_000);
    expect(elapsedMs(b, T0 + 999_000)).toBe(92_000);
  });
});

describe('F09 · troca cruzada 4↔5 mantém as leituras rejeitadas no kart certo', () => {
  it('rejeitadas do 4 vão para o 5 e as do 5 para o 4', () => {
    const s = corrida([{ kart: '4', name: 'Ana', customerId: '1' }, { kart: '5', name: 'Bia', customerId: '2' }]);
    s.rejected = [
      { id: 'r4', kart: '4', transponder: 4, wallMs: T0, decoderTimeMs: 0, reason: 'ignored-min-lap', sinceLastMs: null },
      { id: 'r5', kart: '5', transponder: 5, wallMs: T0, decoderTimeMs: 0, reason: 'ignored-min-lap', sinceLastMs: null },
    ];
    setCompetitors(s, [{ kart: '5', name: 'Ana', customerId: '1' }, { kart: '4', name: 'Bia', customerId: '2' }]);
    expect(s.rejected.find((r) => r.id === 'r4')?.kart).toBe('5');
    expect(s.rejected.find((r) => r.id === 'r5')?.kart).toBe('4');
  });
});

describe('F11 / F12 · kart físico depois da troca', () => {
  function comTroca() {
    const s = corrida([{ kart: '4', name: 'Ana', customerId: '1' }]);
    // 10 min no kart 4 (60 s por volta)
    for (let i = 0; i <= 10; i++) passa(s, '4', T0 + 1000 + i * 60_000);
    swapKart(s, { fromKart: '4', toKart: '5', customerId: '1' });
    // 10 min no kart 5 (90 s por volta)
    const ini = T0 + 1000 + 12 * 60_000;
    for (let i = 0; i <= 6; i++) passa(s, '5', ini + i * 100_000);
    closeSession(s, ini + 700_000);
    return s;
  }

  it('equalização importa só as voltas do kart 5', () => {
    const origem = comTroca();
    const eq = createSession({ id: 'eq', name: 'Equalização', type: 'equalizacao', durationMin: 0, now: T0, competitors: [] });
    const r = importarKarts(eq, origem, ['5']);
    expect(r.importados[0]).toMatchObject({ kart: '5', voltas: 6 });
    const voltas = eq.competitors[0].crossings.filter((x) => !x.deleted && x.lapMs != null).map((x) => x.lapMs);
    expect(voltas.every((ms) => ms === 100_000)).toBe(true);
  });

  it('uso da oficina separa os karts: 10 min cada', () => {
    const uso = usoKartsDaSessao(comTroca());
    expect(uso.find((k) => k.kart === '4')?.minutos).toBe(10);
    expect(uso.find((k) => k.kart === '5')?.minutos).toBe(10);
  });

  it('bateria sem troca continua igual', () => {
    const s = corrida([{ kart: '7', name: 'Cid' }]);
    passa(s, '7', T0); passa(s, '7', T0 + 15 * 60_000);
    expect(usoKartsDaSessao(s)).toEqual([{ kart: '7', minutos: 15 }]);
  });
});

describe('F03 · mover o grupo de evento leva as provas', () => {
  it('o cadastro continua válido e a prova aponta para o evento novo', () => {
    const c = emptyCatalog();
    const a = createCatalogRecord(c, 'events', { name: 'Evento A' }, 'ea', T0) as { id: string };
    const b = createCatalogRecord(c, 'events', { name: 'Evento B' }, 'eb', T0) as { id: string };
    const g = createCatalogRecord(c, 'groups', { name: 'Grupo', eventId: a.id }, 'g1', T0) as { id: string };
    createCatalogRecord(c, 'provas', { name: 'Corrida', groupId: g.id, type: 'corrida', durationMin: 10 }, 'p1', T0);
    updateCatalogRecord(c, 'groups', g.id, { eventId: b.id });
    expect(c.provas[0].eventId).toBe(b.id);
    expect(() => normalizeCatalog(JSON.parse(JSON.stringify(c)))).not.toThrow();
  });
});

describe('F10 · sorteio com a lista mudada no meio', () => {
  function bateria() {
    return createSession({ id: 'so', name: 'B', type: 'corrida', durationMin: 10, now: T0, competitors: [
      { kart: '', name: 'Ana', customerId: '1' }, { kart: '', name: 'Bia', customerId: '2' },
    ] });
  }
  it('recusa índice que agora é de outro piloto', () => {
    const s = bateria();
    s.competitors.reverse(); // reordenaram depois do tablet carregar
    expect(() => validarSorteio(s, [{ indice: 0, kart: '10', nome: 'Ana', customerId: '1' }], new Set(['10']))).toThrow(ListaMudouError);
  });
  it('lista intacta aceita; tablet antigo (só índice) continua funcionando', () => {
    const s = bateria();
    expect(() => validarSorteio(s, [{ indice: 0, kart: '10', nome: 'Ana', customerId: '1' }], new Set(['10']))).not.toThrow();
    expect(() => validarSorteio(s, [{ indice: 1, kart: '10' }], new Set(['10']))).not.toThrow();
  });
  it('o sorteio não apaga os detalhes do piloto', () => {
    const s = bateria();
    s.competitors[0].detalhes = { peso: 80 };
    const lista = competidoresComSorteio(s, [{ indice: 0, kart: '10' }]);
    expect(lista[0].detalhes).toEqual({ peso: 80 });
  });
});

describe('F15 · configuração de e-mail', () => {
  const atual = { ...CONFIG_PADRAO, host: 'smtp.gmail.com', porta: 587, usuario: 'caixa@gmail.com', senha: 'segredo-de-teste' };
  it('trocar o servidor sem digitar a senha não leva a senha antiga', () => {
    expect(() => montarConfig(atual, { host: 'smtp.outro.com', usuario: 'caixa@gmail.com', senha: '' })).toThrow('digite a senha');
  });
  it('mesmo servidor e caixa mantém a senha guardada', () => {
    expect(montarConfig(atual, { host: 'smtp.gmail.com', usuario: 'caixa@gmail.com', senha: '', automatico: false }).senha).toBe('segredo-de-teste');
  });
  it('montarConfig não grava nada (usado pelo Enviar teste)', () => {
    const copia = JSON.stringify(atual);
    montarConfig(atual, { host: 'smtp.gmail.com', usuario: 'caixa@gmail.com', remetenteNome: 'Outro' });
    expect(JSON.stringify(atual)).toBe(copia);
  });
});
