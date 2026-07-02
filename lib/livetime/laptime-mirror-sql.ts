import sql from 'mssql';

/**
 * Conexao com o SQL Server que hospeda o banco ESPELHO (`LapTimeMirror`) — por padrao o
 * `SRVKART\SQLEXPRESS` (192.168.20.13), a mesma instancia que ja hospeda o `CALXPRO`. Segue o
 * mesmo formato de `LapTimeSqlOptions` de `lib/livetime/laptime-sql.ts`, mas com pool maior (o
 * daemon de sincronizacao faz muitas escritas concorrentes, ao contrario das leituras pontuais do
 * site).
 */
export type MirrorSqlOptions = {
  server: string;
  database: string;
  user: string;
  password: string;
  instanceName?: string;
  port?: number;
  timeoutMs?: number;
  poolMax?: number;
};

export function mirrorSqlConfig(options: MirrorSqlOptions): sql.config {
  return {
    server: options.server,
    database: options.database,
    user: options.user,
    password: options.password,
    port: options.port,
    connectionTimeout: options.timeoutMs || 15000,
    requestTimeout: options.timeoutMs || 60000,
    pool: { max: options.poolMax || 4, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: options.instanceName,
    },
  };
}

/**
 * Config para LER o banco de origem (`LapTime` no CRONO1). Reaproveitamos o shape de
 * `LapTimeSqlOptions`, mas mantemos aqui um builder proprio para o daemon nao depender do modulo
 * do site. Somente leitura na pratica (o daemon nunca escreve na origem).
 */
export type SourceSqlOptions = MirrorSqlOptions;

export function sourceSqlConfig(options: SourceSqlOptions): sql.config {
  return {
    server: options.server,
    database: options.database,
    user: options.user,
    password: options.password,
    port: options.port,
    connectionTimeout: options.timeoutMs || 15000,
    requestTimeout: options.timeoutMs || 120000,
    pool: { max: options.poolMax || 2, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: options.instanceName,
    },
  };
}

/** Le o horario UTC atual do servidor de origem — usado para ancorar o token da API local. */
export async function readServerUtcNow(pool: sql.ConnectionPool): Promise<Date> {
  const result = await pool.request().query<{ nowUtc: Date }>('select GETUTCDATE() as nowUtc');
  return new Date(result.recordset[0].nowUtc);
}
