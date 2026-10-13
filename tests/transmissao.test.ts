import { describe, expect, it } from 'vitest';
import type { Standing } from '../lib/timing/race-engine';
import {
  conferirChave,
  extrairChave,
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
