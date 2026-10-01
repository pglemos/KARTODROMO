import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

type ReportRow = {
  position: number;
  kart: string;
  laps: number;
  bestLapTime: number | null;
  bestLapTime2nd?: number | null;
  totalMs: number | null;
};

function loadReportRanking() {
  const html = readFileSync(resolve(process.cwd(), 'services/timing-ui/resultado.html'), 'utf8');
  const start = html.indexOf('function ordenarResultadoOficial(');
  const end = html.indexOf('\n}\n\nfunction renderReport', start);
  if (start < 0 || end < 0) throw new Error('Função de ordenação do relatório não encontrada.');

  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(
    `${html.slice(start, end + 3)}\nglobalThis.ordenarResultadoOficial = ordenarResultadoOficial;`,
    sandbox,
  );
  return sandbox.ordenarResultadoOficial as (rows: ReportRow[], tipo: string, sessionType: string) => ReportRow[];
}

function reportHtml() {
  return readFileSync(resolve(process.cwd(), 'services/timing-ui/resultado.html'), 'utf8');
}

function loadReportHelpers() {
  const html = reportHtml();
  const start = html.indexOf('function getResultadoCriterio(');
  const end = html.indexOf('\nfunction renderReport', start);
  if (start < 0 || end < 0) throw new Error('Helpers de apresentação do relatório não encontrados.');

  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(
    `${html.slice(start, end)}\nglobalThis.getResultadoCriterio = getResultadoCriterio;\nglobalThis.calcularPaginasRelatorio = calcularPaginasRelatorio;\nglobalThis.obterUltimaFoto = obterUltimaFoto;`,
    sandbox,
  );
  return {
    getResultadoCriterio: sandbox.getResultadoCriterio as (sessionType: string) => Record<string, string>,
    calcularPaginasRelatorio: sandbox.calcularPaginasRelatorio as (contentHeight: number, pageHeight: number) => number,
    obterUltimaFoto: sandbox.obterUltimaFoto as (row: Record<string, unknown>) => number | null,
  };
}

describe('ordenação do relatório de cronometragem', () => {
  it('usa a ordenação oficial também no relatório padrão de uma corrida', () => {
    expect(reportHtml()).toContain('const list = ordenarResultadoOficial(enriched, currentTipo, v.type);');
  });

  it('mantém a classificação oficial da corrida mesmo quando a melhor volta aponta outra ordem', () => {
    const ordenar = loadReportRanking();
    const rows: ReportRow[] = [
      { position: 1, kart: '34', laps: 18, bestLapTime: 75_159, totalMs: 1_450_000 },
      { position: 2, kart: '39', laps: 18, bestLapTime: 70_000, totalMs: 1_440_000 },
      { position: 3, kart: '15', laps: 17, bestLapTime: 68_000, totalMs: 1_300_000 },
    ];

    expect(ordenar(rows, 'resultados_oficiais', 'corrida').map((row) => row.kart)).toEqual(['34', '39', '15']);
  });

  it('ordena tomada de tempo pela melhor volta', () => {
    const ordenar = loadReportRanking();
    const rows: ReportRow[] = [
      { position: 1, kart: '34', laps: 3, bestLapTime: 75_159, totalMs: 1_450_000 },
      { position: 2, kart: '39', laps: 3, bestLapTime: 70_000, totalMs: 1_440_000 },
    ];

    expect(ordenar(rows, 'resultados_oficiais', 'classificacao').map((row) => row.kart)).toEqual(['39', '34']);
  });

  it('explicita o critério de cada tipo de sessão', () => {
    const { getResultadoCriterio } = loadReportHelpers();

    expect(getResultadoCriterio('corrida')).toEqual({
      label: 'CLASSIFICAÇÃO OFICIAL',
      detail: 'ordem de chegada',
    });
    expect(getResultadoCriterio('classificacao')).toEqual({
      label: 'TOMADA DE TEMPO',
      detail: 'melhor volta',
    });
  });

  it('calcula uma paginação transparente sem afirmar sempre uma única página', () => {
    const { calcularPaginasRelatorio } = loadReportHelpers();

    expect(calcularPaginasRelatorio(900, 1100)).toBe(1);
    expect(calcularPaginasRelatorio(2201, 1100)).toBe(3);
    expect(calcularPaginasRelatorio(0, 1100)).toBe(1);
  });

  it('não usa posição de largada como falsa última foto', () => {
    const { obterUltimaFoto } = loadReportHelpers();

    expect(obterUltimaFoto({ startPos: 4, position: 1 })).toBeNull();
    expect(obterUltimaFoto({ lastPhoto: 7 })).toBe(7);
    expect(obterUltimaFoto({ lastPhotoNumber: 8 })).toBe(8);
  });

  it('mantém os contratos de clareza, acessibilidade e estados de falha do relatório', () => {
    const html = reportHtml();

    expect(html).toContain('CLASSIFICAÇÃO OFICIAL');
    expect(html).toContain('TOMADA DE TEMPO');
    expect(html).toContain('ordem de chegada');
    expect(html).toContain('melhor volta');
    expect(html).toContain('Dados técnicos indisponíveis');
    expect(html).toContain('id="retryReportButton"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('<main');
    expect(html).toContain('@page portrait');
    expect(html).toContain('@page landscape');
    expect(html).not.toContain('Página 1 de 1');
    expect(html).not.toContain('uf: s.startPos || s.position');
  });
});
