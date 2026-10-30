import { describe, expect, it } from 'vitest';
import type { Standing } from '../lib/timing/race-engine';
import {
  conferirChave,
  extrairChave,
  filtrarVoltasPorKart,
  montarVoltas,
  lerHashes,
  montarTransmissao,
  sha256Hex,
  assinaturaDoConteudo,
  type SessaoParaTransmissao,
} from '../lib/timing/transmissao';

function linha(p: Partial<Standing> & { position: number; kart: string; name: string }): Standing {
  return {
    category: null, laps: 0, lastLapMs: null, bestLapMs: null, bestLapNumber: null, totalMs: null, averageSpeedKmh: null,
    gapMs: null, gapLaps: 0, finished: false, autoAdded: false, lastCrossingWallMs: null, ...p,
  };
}

function corrida(extra: Partial<SessaoParaTransmissao> = {}): SessaoParaTransmissao {
  return {
    id: 'b1', name: 'BATERIA 20:00 · CORRIDA', type: 'corrida', state: 'em_andamento', durationMs: 600_000, maxLaps: null,
    startedAt: Date.UTC(2026, 9, 8, 23, 0, 0), checkeredAt: null, finishedAt: null, remainingMs: 300_000, elapsedMs: 300_000,
    chuva: false, currentFlag: 'green', track: { name: 'Traçado principal', lengthMeters: 1000 },
    standings: [
      linha({ position: 1, kart: '4', name: 'Ana Souza', laps: 10, lastLapMs: 63_228, bestLapMs: 62_100, bestLapNumber: 7, totalMs: 640_000, gapMs: null }),
      linha({ position: 2, kart: '5', name: 'Bia Lima', laps: 10, lastLapMs: 63_027, bestLapMs: 61_900, bestLapNumber: 3, totalMs: 641_500, gapMs: 1_500 }),
      linha({ position: 3, kart: '6', name: 'Caio Reis', laps: 8, lastLapMs: 70_000, bestLapMs: 66_000, totalMs: 650_000, gapMs: null, gapLaps: 2 }),
    ],
    ...extra,
  };
}

describe('API de transmissão ao vivo — retrato público', () => {
  it('sem bateria (ou equalização, que é interna) devolve situação sem-bateria e lista vazia', () => {
    expect(montarTransmissao(null).situacao).toBe('sem-bateria');
    const eq = montarTransmissao({ ...corrida(), type: 'equalizacao' });
    expect(eq.situacao).toBe('sem-bateria');
    expect(eq.pilotos).toEqual([]);
  });

  it('corrida em andamento: bandeira, cronômetro, diferença e intervalo em tempo e em voltas', () => {
    const t = montarTransmissao(corrida(), Date.UTC(2026, 9, 8, 23, 5, 0));
    expect(t.versao).toBe(1);
    expect(t.situacao).toBe('em-andamento');
    expect(t.bateria).toMatchObject({ tipo: 'corrida', tipoTexto: 'Corrida', bandeira: 'verde', restanteMs: 300_000, voltasDoLider: 10, classificacaoPor: 'voltas-e-tempo' });
    const [p1, p2, p3] = t.pilotos;
    expect(p1).toMatchObject({ posicao: 1, diferencaLider: null, intervalo: null, ultimaVolta: '1:03.228' });
    expect(p2).toMatchObject({ diferencaLiderMs: 1_500, diferencaLider: '+1.500', intervaloMs: 1_500, intervalo: '+1.500' });
    expect(p3).toMatchObject({ diferencaLiderVoltas: 2, diferencaLider: '+2 voltas', intervalo: '+2 voltas' });
  });

  it('marca a melhor volta da bateria (e ignora desclassificado)', () => {
    const t = montarTransmissao(corrida());
    expect(t.melhorVolta).toMatchObject({ kart: '5', nome: 'Bia Lima', tempo: '1:01.900', volta: 3 });
    expect(t.pilotos.filter((p) => p.melhorDaBateria).map((p) => p.kart)).toEqual(['5']);
    const dc = corrida();
    dc.standings[1] = { ...dc.standings[1], desclassificado: true };
    expect(montarTransmissao(dc).melhorVolta?.kart).toBe('4');
  });

  it('não expõe dado pessoal nem interno (cliente, e-mail, observações)', () => {
    const json = JSON.stringify(montarTransmissao({ ...corrida(), standings: corrida().standings.map((r) => ({ ...r, customerId: 'C123' }) as Standing) }));
    expect(json).not.toMatch(/customerId|email|observa|C123/i);
  });

  it('situações: aguardando largada, quadriculada, encerrada', () => {
    expect(montarTransmissao(corrida({ startedAt: null })).situacao).toBe('aguardando-largada');
    expect(montarTransmissao(corrida({ state: 'bandeira_final', currentFlag: 'checkered' })).bateria?.bandeira).toBe('quadriculada');
    expect(montarTransmissao(corrida({ state: 'encerrada' })).situacao).toBe('encerrada');
  });

  it('a assinatura só muda quando o conteúdo muda (não pelo carimbo de hora)', () => {
    const a = montarTransmissao(corrida(), 1000);
    const b = montarTransmissao(corrida(), 2000);
    expect(assinaturaDoConteudo(a)).toBe(assinaturaDoConteudo(b));
    expect(assinaturaDoConteudo(montarTransmissao(corrida({ currentFlag: 'yellow' })))).not.toBe(assinaturaDoConteudo(a));
  });
});

describe('API de transmissão ao vivo — chave', () => {
  const chave = 'kib_tx_' + 'a'.repeat(43);

  it('aceita só a chave cujo SHA-256 está cadastrado, e informa o rótulo do parceiro', async () => {
    const aceitos = lerHashes(`cosmo:${await sha256Hex(chave)}`);
    expect(await conferirChave(chave, aceitos)).toBe('cosmo');
    expect(await conferirChave(chave + 'x', aceitos)).toBeNull();
    expect(await conferirChave('', aceitos)).toBeNull();
    expect(await conferirChave(chave, [])).toBeNull();
  });

  it('ignora hash mal formado na configuração', () => {
    expect(lerHashes('cosmo:123, :abc, ' + 'f'.repeat(64))).toEqual([{ rotulo: 'parceiro', hash: 'f'.repeat(64) }]);
  });

  it('lê a chave do Authorization: Bearer, do X-Api-Key ou de ?chave=', () => {
    const url = new URL('https://x/api?chave=Q');
    expect(extrairChave((n) => (n === 'authorization' ? 'Bearer  ABC ' : null), url)).toBe('ABC');
    expect(extrairChave((n) => (n === 'x-api-key' ? 'XYZ' : null), url)).toBe('XYZ');
    expect(extrairChave(() => null, url)).toBe('Q');
  });
});

describe('volta a volta da transmissão', () => {
  const base = montarTransmissao({
    id: 'b1', name: 'B', type: 'corrida', state: 'em_andamento', durationMs: 600_000, maxLaps: null, startedAt: 1, checkeredAt: null, finishedAt: null, remainingMs: 1000, elapsedMs: 1000, currentFlag: 'green',
    standings: [{ position: 1, kart: '4', name: 'Ana', category: null, laps: 2, lastLapMs: 61_000, bestLapMs: 60_000, bestLapNumber: 1, totalMs: 121_000, averageSpeedKmh: 60, gapMs: null, gapLaps: 0, finished: false, autoAdded: false, lastCrossingWallMs: null, penaltyMs: 5000 }],
  });

  it('não conta a abertura, ignora apagada e marca anulada e melhor', () => {
    const v = montarVoltas(base, [{ kart: '4', nome: 'Ana', crossings: [
      { wallMs: 1000, lapMs: null },
      { wallMs: 61_000, lapMs: 60_000 },
      { wallMs: 70_000, lapMs: 9_000, deleted: true },
      { wallMs: 122_000, lapMs: 61_000, invalid: true },
    ] }]);
    expect(v.pilotos[0].penalidadeMs).toBe(5000);
    expect(v.pilotos[0].voltas.map((x) => [x.volta, x.tempoMs, x.valida, x.melhor])).toEqual([[1, 60_000, true, true], [2, 61_000, false, false]]);
  });

  it('filtra por kart', () => {
    const v = montarVoltas(base, []);
    expect(filtrarVoltasPorKart(v, '9').pilotos).toEqual([]);
    expect(filtrarVoltasPorKart(v, null).pilotos).toHaveLength(1);
  });
});

describe('correções de 30/10', () => {
  const linha = (position: number, kart: string, laps: number, wall: number, gapLaps: number, penaltyMs = 0) => ({ position, kart, name: kart, category: null, laps, lastLapMs: 60_000, bestLapMs: 60_000, bestLapNumber: 1, totalMs: 1, averageSpeedKmh: 60, gapMs: null, gapLaps, finished: false, autoAdded: false, lastCrossingWallMs: wall, penaltyMs });
  const s = { id: 'b', name: 'B', type: 'corrida' as const, state: 'encerrada' as const, durationMs: 0, maxLaps: null, startedAt: 1, checkeredAt: 2, finishedAt: 3, remainingMs: 0, elapsedMs: 1, currentFlag: 'checkered' };

  it('intervalo entre retardatários na mesma volta, com penalidade', () => {
    const t = montarTransmissao({ ...s, standings: [linha(1, '1', 10, 1000, 0), linha(2, '2', 9, 2000, 1), linha(3, '3', 9, 3500, 1, 2000)] });
    expect(t.pilotos[1].intervalo).toBe('+1 volta');
    expect(t.pilotos[2].intervaloMs).toBe(3500);
    expect(t.pilotos[2].diferencaLider).toBe('+1 volta');
  });

  it('bateria encerrada: todos terminaram', () => {
    expect(montarTransmissao({ ...s, standings: [linha(1, '1', 10, 1000, 0)] }).pilotos[0].terminou).toBe(true);
  });
});
