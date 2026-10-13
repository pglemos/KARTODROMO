import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const armazenado = new Map<string, unknown>();
vi.mock('@/lib/r2-client', () => ({
  hasR2Store: () => true,
  getR2Json: async (k: string) => (armazenado.has(k) ? JSON.parse(JSON.stringify(armazenado.get(k))) : null),
  putR2Json: async (k: string, v: unknown) => { armazenado.set(k, v); },
}));

import { GET, OPTIONS } from '@/app/api/transmissao/v1/corrida/route';
import { POST } from '@/app/api/transmissao/v1/publicar/route';
import { esquecerMemoria } from '@/lib/timing/transmissao-nuvem';
import { montarTransmissao, sha256Hex } from '@/lib/timing/transmissao';

const CHAVE_PARCEIRO = 'kib_tx_' + 'p'.repeat(43);
const CHAVE_PUBLICAR = 'kib_tx_' + 'o'.repeat(43);
const URL_BASE = 'https://kartodromodebetim.com.br/api/transmissao/v1';

function retrato() {
  return montarTransmissao({
    id: 'b1', name: 'BATERIA 20:00', type: 'corrida', state: 'em_andamento', durationMs: 600_000, maxLaps: null,
    startedAt: 1, checkeredAt: null, finishedAt: null, remainingMs: 1000, elapsedMs: 1000, currentFlag: 'green',
    standings: [{ position: 1, kart: '4', name: 'Ana', category: null, laps: 3, lastLapMs: 60_000, bestLapMs: 59_000, bestLapNumber: 2, totalMs: 180_000, averageSpeedKmh: 60, gapMs: null, gapLaps: 0, finished: false, autoAdded: false, lastCrossingWallMs: null }],
  });
}

function publicar(corpo: unknown, chave = CHAVE_PUBLICAR) {
  return POST(new Request(`${URL_BASE}/publicar`, { method: 'POST', headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }));
}

function ler(chave?: string, consulta = '') {
  return GET(new Request(`${URL_BASE}/corrida${consulta}`, { headers: chave ? { authorization: `Bearer ${chave}` } : {} }));
}

describe('API de transmissão no site (Cloudflare)', () => {
  beforeEach(async () => {
    armazenado.clear();
    esquecerMemoria();
    process.env.TRANSMISSAO_CHAVES_SHA256 = `cosmo:${await sha256Hex(CHAVE_PARCEIRO)}`;
    process.env.TRANSMISSAO_PUBLICACAO_SHA256 = `orbits:${await sha256Hex(CHAVE_PUBLICAR)}`;
  });
  afterEach(() => {
    delete process.env.TRANSMISSAO_CHAVES_SHA256;
    delete process.env.TRANSMISSAO_PUBLICACAO_SHA256;
    vi.useRealTimers();
  });

  it('sem configuração responde 503 (nada vaza enquanto não houver chave)', async () => {
    delete process.env.TRANSMISSAO_CHAVES_SHA256;
    expect((await ler(CHAVE_PARCEIRO)).status).toBe(503);
  });

  it('leitura sem chave ou com chave errada: 401', async () => {
    expect((await ler()).status).toBe(401);
    expect((await ler('kib_tx_' + 'x'.repeat(43))).status).toBe(401);
    // a chave de PUBLICAR não serve para ler, e a do parceiro não serve para publicar
    expect((await ler(CHAVE_PUBLICAR)).status).toBe(401);
    expect((await publicar(retrato(), CHAVE_PARCEIRO)).status).toBe(401);
  });

  it('ORBITS publica, parceiro lê o mesmo retrato marcado ao vivo', async () => {
    expect((await publicar(retrato())).status).toBe(200);
    esquecerMemoria();
    const resposta = await ler(CHAVE_PARCEIRO);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('cache-control')).toContain('no-store');
    const corpo = await resposta.json();
    expect(corpo).toMatchObject({ versao: 1, situacao: 'em-andamento', sinal: 'ao-vivo', bateria: { nome: 'BATERIA 20:00', bandeira: 'verde' } });
    expect(corpo.pilotos[0]).toMatchObject({ kart: '4', nome: 'Ana', melhorVolta: '59.000' });
  });

  it('a chave também vale em ?chave= (fonte de navegador do OBS/vMix)', async () => {
    await publicar(retrato());
    expect((await ler(undefined, `?chave=${CHAVE_PARCEIRO}`)).status).toBe(200);
  });

  it('sem envio do ORBITS há mais de 90 s o retrato vai como sem-sinal', async () => {
    await publicar(retrato());
    esquecerMemoria();
    vi.useFakeTimers({ now: Date.now() + 120_000 });
    expect((await (await ler(CHAVE_PARCEIRO)).json()).sinal).toBe('sem-sinal');
  });

  it('nada publicado ainda: sem-bateria, sem erro', async () => {
    expect(await (await ler(CHAVE_PARCEIRO)).json()).toMatchObject({ situacao: 'sem-bateria', pilotos: [] });
  });

  it('recusa formato errado e responde ao preflight do navegador', async () => {
    expect((await publicar({ versao: 2, pilotos: [] })).status).toBe(400);
    const pre = OPTIONS();
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
  });
});
