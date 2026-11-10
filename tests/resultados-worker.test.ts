import { describe, expect, it, vi } from 'vitest';
import worker from '../workers/resultados/src/index';

function createMockD1(rows: any[] = []) {
  const handler = (sql: string) => ({
    all: vi.fn(async () => {
      if (sql.includes('DISTINCT event_date')) {
        return { results: [{ event_date: '2026-11-07' }, { event_date: '2026-11-06' }] };
      }
      if (sql.includes('GROUP BY session_id')) {
        return {
          results: [
            {
              session_id: 'sess-1',
              event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
              event_date: '2026-11-07',
              publicado: 1794072600000,
              total_pilotos: 2,
              menor_tempo: 80319,
            },
          ],
        };
      }
      if (sql.includes('position <= 3')) {
        return {
          results: [
            { session_id: 'sess-1', display_name: 'Vitor Vaz', position: 1, kart: '58', best_lap_ms: 80319, laps: 4 },
            { session_id: 'sess-1', display_name: 'Thiago Fonseca', position: 2, kart: '24', best_lap_ms: 80750, laps: 4 },
          ],
        };
      }
      if (sql.includes('WHERE status = \'published\' AND session_id = ?')) {
        return {
          results: [
            {
              session_id: 'sess-1',
              customer_id: '47531',
              event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
              event_date: '2026-11-07',
              display_name: 'Vitor Vaz',
              position: 1,
              kart: '58',
              laps: 4,
              best_lap_ms: 80319,
              status: 'published',
              updated_at: 1794072600000,
            },
            {
              session_id: 'sess-1',
              customer_id: '60568',
              event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
              event_date: '2026-11-07',
              display_name: 'Thiago Fonseca',
              position: 2,
              kart: '24',
              laps: 4,
              best_lap_ms: 80750,
              status: 'published',
              updated_at: 1794072600000,
            },
          ],
        };
      }
      if (sql.includes('customer_id = ?')) {
        return {
          results: [
            {
              session_id: 'sess-1',
              customer_id: '47531',
              event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
              event_date: '2026-11-07',
              display_name: 'Vitor Vaz',
              position: 1,
              kart: '58',
              laps: 4,
              best_lap_ms: 80319,
            },
          ],
        };
      }
      if (sql.includes('kart = ?')) {
        return {
          results: [
            {
              session_id: 'sess-1',
              customer_id: '47531',
              event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
              event_date: '2026-11-07',
              display_name: 'Vitor Vaz',
              position: 1,
              kart: '58',
              laps: 4,
              best_lap_ms: 80319,
            },
          ],
        };
      }
      if (sql.includes('display_name LIKE ?')) {
        return {
          results: [
            {
              session_id: 'sess-1',
              customer_id: '47531',
              event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
              event_date: '2026-11-07',
              display_name: 'Vitor Vaz',
              position: 1,
              kart: '58',
              laps: 4,
              best_lap_ms: 80319,
            },
          ],
        };
      }
      return { results: rows };
    }),
    first: vi.fn(async () => {
      return {
        event_name: 'BATERIA 14:30 · TOMADA DE TEMPO',
        event_date: '2026-11-07',
        display_name: 'Vitor Vaz',
        position: 1,
        laps: 4,
        best_lap_ms: 80319,
      };
    }),
  });

  return {
    prepare: vi.fn((sql: string) => ({
      ...handler(sql),
      bind: vi.fn((...args: any[]) => handler(sql)),
    })),
  } as any;
}

describe('Portal de Resultados Worker (resultados.kartodromodebetim.com.br)', () => {
  it('deve listar baterias com pódio e melhor volta calculada', async () => {
    const mockDb = createMockD1();
    const env = {
      ASSETS: { fetch: vi.fn() },
      MOBILE_DB: mockDb,
    } as any;

    const req = new Request('http://resultados.kartodromodebetim.com.br/api/baterias?data=2026-11-07');
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as any;
    expect(body.data).toBe('2026-11-07');
    expect(body.total).toBe(1);
    expect(body.baterias[0].sessionId).toBe('sess-1');
    expect(body.baterias[0].horario).toBe('14:30');
    expect(body.baterias[0].melhorVolta.tempoFmt).toBe('1:20.319');
    expect(body.baterias[0].podio.length).toBe(2);
    expect(resp.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('deve retornar detalhe completo da classificação da bateria', async () => {
    const mockDb = createMockD1();
    const env = {
      ASSETS: { fetch: vi.fn() },
      MOBILE_DB: mockDb,
    } as any;

    const req = new Request('http://resultados.kartodromodebetim.com.br/api/bateria/sess-1');
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as any;
    expect(body.sessionId).toBe('sess-1');
    expect(body.classificacao.length).toBe(2);
    expect(body.classificacao[0].piloto).toBe('Vitor Vaz');
    expect(body.classificacao[0].kart).toBe('58');
    expect(body.classificacao[0].isMelhorVoltaSessao).toBe(true);
    expect(body.classificacao[1].difLider).toBe('+0.431');
  });

  it('deve identificar piloto por número de kart', async () => {
    const mockDb = createMockD1();
    const env = {
      ASSETS: { fetch: vi.fn() },
      MOBILE_DB: mockDb,
    } as any;

    const req = new Request('http://resultados.kartodromodebetim.com.br/api/identificar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identificador: '58' }),
    });

    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as any;
    expect(body.tipo).toBe('kart');
    expect(body.kart).toBe('58');
    expect(body.baterias[0].sessionId).toBe('sess-1');
  });

  it('deve gerar relatório HTML para PDF da bateria com cabeçalho oficial e tabela', async () => {
    const mockDb = createMockD1();
    const env = {
      ASSETS: { fetch: vi.fn() },
      MOBILE_DB: mockDb,
    } as any;

    const req = new Request('http://resultados.kartodromodebetim.com.br/api/pdf/bateria/sess-1');
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/html');

    const htmlText = await resp.text();
    expect(htmlText).toContain('KARTÓDROMO INTERNACIONAL DE BETIM');
    expect(htmlText).toContain('BATERIA 14:30');
    expect(htmlText).toContain('Vitor Vaz');
    expect(htmlText).toContain('1:20.319');
    expect(htmlText).toContain('sheet-page portrait');
    expect(htmlText).toContain('size: 210mm 297mm portrait');
    expect(htmlText).toContain('signatures-table');
  });

  it('deve gerar relatório HTML para PDF do volta a volta do kart', async () => {
    const mockDb = createMockD1();
    const env = {
      ASSETS: { fetch: vi.fn() },
      MOBILE_DB: mockDb,
      CRONO_URL: 'http://crono.mock',
    } as any;

    // Mock do fetch para laps
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify([
        {
          kart: '58',
          name: 'Vitor Vaz',
          laps: [
            { lap: 1, lapMs: 82195, invalid: false, wallMs: 1794072347283 },
            { lap: 2, lapMs: 80319, invalid: false, wallMs: 1794072429548 },
          ],
        },
      ]));
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = new Request('http://resultados.kartodromodebetim.com.br/api/pdf/piloto/sess-1/58');
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(200);

    const htmlText = await resp.text();
    expect(htmlText).toContain('Vitor Vaz');
    expect(htmlText).toContain('Kart: <b>#58</b>');
    expect(htmlText).toContain('1:20.319');
    expect(htmlText).toContain('sheet-page portrait');
    expect(htmlText).toContain('size: 210mm 297mm portrait');
    expect(htmlText).toContain('signatures-table');

    vi.unstubAllGlobals();
  });
});
