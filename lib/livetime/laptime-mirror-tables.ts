/**
 * Classificacao de como cada tabela do `LapTime` (CRONO1) e' sincronizada para o espelho
 * (`LapTimeMirror` no SRVKART). Em vez de enumerar as ~84 tabelas uma a uma, classificamos por
 * regra a partir do nome + contagem de linhas + coluna identity — assim continua funcionando se o
 * fornecedor adicionar/remover tabelas numa atualizacao.
 *
 * Modos:
 *  - `incremental`: tabela grande e efetivamente so-insercao (log). Copia so linhas novas via
 *    `WHERE <id> > @checkpoint`. Nunca sofre UPDATE/DELETE na origem, entao e' seguro e barato.
 *  - `reload`: `TRUNCATE` + `INSERT` do conteudo inteiro a cada ciclo. Usado para tabelas que
 *    sofrem UPDATE/DELETE em producao (reservas, corridas, clientes) — o reload total e' a forma
 *    mais simples e correta de refletir alteracoes e remocoes, dado que nenhuma dessas tabelas tem
 *    coluna de rastreio de alteracao (`rowversion`/`LastUpdate`) exceto as de baixa prioridade.
 *  - `skip`: tabelas de sistema que nao interessam ao espelho.
 */

export type SyncMode = 'incremental' | 'reload';

export type TableSyncPlan = {
  name: string;
  idColumn: string | null;
  mode: SyncMode;
  intervalMs: number;
};

export type SourceTableInfo = {
  name: string;
  rows: number;
  idColumn: string | null;
};

// Tabelas de sistema/EF que nao espelhamos.
const SKIP_TABLES = new Set(['sysdiagrams', '__EFMigrationsHistory']);

// Grandes e so-insercao (logs/historico/vendas). Sincronizadas incrementalmente por identity.
const APPEND_ONLY_TABLES = new Set([
  'RegisterCode',
  'Passing',
  'VehicleHistory',
  'HistSale',
  'HistSaleItem',
  'HistSalePaymentMethod',
  'PosSale',
  'PosSaleItem',
  'PosSalePaymentMethod',
  'PosResumePaymentMethod',
  'PosMovement',
  'PosTransaction',
  'AccessLog',
]);

// Operacionais e "ao vivo": pequenas, mudam a toda hora, o site le direto. Reload rapido.
const FAST_OPERATIONAL_TABLES = new Set([
  'Booking',
  'BookingConfig',
  'Racing',
  'RacingCompetitor',
  'RacingEvent',
  'RacingEventGroup',
  'RacingGroup',
  'RacingType',
  'RacingFlag',
  'RacingTrack',
  'Ranking',
  'RankingType',
  'OpenedRacing',
  'TransponderCompetitor',
  'TransponderRenumber',
  'VehicleControl',
  'Product',
  'ProductRacingType',
  'Category',
  'Sport',
  'PaymentMethod',
]);

// Mutaveis mas medias (mudam in-place, dezenas de milhares de linhas). Reload em cadencia media.
const MEDIUM_MUTABLE_TABLES = new Set(['Customer', 'BookingCustomer']);

export const INTERVALS = {
  fast: Number(process.env.MIRROR_FAST_INTERVAL_MS || '10000'),
  incremental: Number(process.env.MIRROR_INCREMENTAL_INTERVAL_MS || '30000'),
  medium: Number(process.env.MIRROR_MEDIUM_INTERVAL_MS || '60000'),
  slow: Number(process.env.MIRROR_SLOW_INTERVAL_MS || '900000'), // 15 min
};

export function classifyTable(info: SourceTableInfo): TableSyncPlan | null {
  if (SKIP_TABLES.has(info.name)) {
    return null;
  }

  // So-insercao grande, e temos coluna identity pra ancorar: incremental.
  if (APPEND_ONLY_TABLES.has(info.name) && info.idColumn) {
    return { name: info.name, idColumn: info.idColumn, mode: 'incremental', intervalMs: INTERVALS.incremental };
  }

  if (FAST_OPERATIONAL_TABLES.has(info.name)) {
    return { name: info.name, idColumn: info.idColumn, mode: 'reload', intervalMs: INTERVALS.fast };
  }

  if (MEDIUM_MUTABLE_TABLES.has(info.name)) {
    return { name: info.name, idColumn: info.idColumn, mode: 'reload', intervalMs: INTERVALS.medium };
  }

  // Qualquer append-only sem identity (ex: AccessLog) tambem cai em reload lento.
  // Todo o resto (config, RBAC, financeiro, fidelidade) muda pouco e o site nao le: reload lento.
  return { name: info.name, idColumn: info.idColumn, mode: 'reload', intervalMs: INTERVALS.slow };
}

export function buildSyncPlan(tables: SourceTableInfo[]): TableSyncPlan[] {
  return tables
    .map(classifyTable)
    .filter((plan): plan is TableSyncPlan => plan !== null);
}
