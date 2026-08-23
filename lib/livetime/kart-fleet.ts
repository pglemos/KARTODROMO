import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type LapTimeKartFleetRow = {
  numero: string;
  categoria: 'indoor' | 'super';
  usoQuantidade: number | null;
  tempoUsoMs: number | null;
  ultimaManutencao: string | null;
  statusControle: number | null;
  observadoEm: string | null;
  sensorNumeroFonte: string | null;
};

type SqlKartFleetRow = {
  Number: string | number | null;
  Quantity: number | null;
  TimeofUse: Date | string | null;
  LastMaintenance: Date | string | null;
  StatusControl: number | null;
  DateControl: Date | string | null;
  SensorNumber: number | string | null;
};

function clean(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeKartPlate(value: unknown): string | null {
  const number = Number(clean(value));
  if (!Number.isInteger(number) || number < 1 || number > 200) return null;
  return number < 100 ? String(number).padStart(2, '0') : String(number);
}

export function kartCategoryFromNumber(value: string): 'indoor' | 'super' {
  return Number(value) < 100 ? 'indoor' : 'super';
}

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function timeOfUseMs(value: Date | string | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (((date.getUTCHours() * 60 + date.getUTCMinutes()) * 60 + date.getUTCSeconds()) * 1000) + date.getUTCMilliseconds();
}

function sqlConfig(options: LapTimeSqlOptions): sql.config {
  return {
    server: options.server,
    database: options.database,
    user: options.user,
    password: options.password,
    port: options.port,
    connectionTimeout: options.timeoutMs || 5000,
    requestTimeout: Math.max(options.timeoutMs || 5000, 15000),
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true, instanceName: options.instanceName },
  };
}

function toFleetRow(row: SqlKartFleetRow): LapTimeKartFleetRow | null {
  const numero = normalizeKartPlate(row.Number);
  if (!numero) return null;

  return {
    numero,
    categoria: kartCategoryFromNumber(numero),
    usoQuantidade: row.Quantity === null || row.Quantity === undefined ? null : Number(row.Quantity),
    tempoUsoMs: timeOfUseMs(row.TimeofUse),
    ultimaManutencao: isoDate(row.LastMaintenance),
    statusControle: row.StatusControl === null || row.StatusControl === undefined ? null : Number(row.StatusControl),
    observadoEm: isoDate(row.DateControl),
    sensorNumeroFonte: row.SensorNumber === null || row.SensorNumber === undefined ? null : clean(row.SensorNumber) || null,
  };
}

/**
 * VehicleControl is the LapTime fleet register. The latest record per numeric
 * plate is authoritative; raw values such as "01" and "1" are one kart.
 * TransponderRenumber supplies the physical transponder currently assigned to
 * that plate when the source has a mapping.
 */
export async function fetchLapTimeKartFleet(options: LapTimeSqlOptions): Promise<LapTimeKartFleetRow[]> {
  const pool = new sql.ConnectionPool(sqlConfig(options));

  try {
    await pool.connect();
    const result = await pool.request().query<SqlKartFleetRow>(`
      with raw as (
        select
          vc.*,
          try_convert(int, ltrim(rtrim(vc.Number))) as KartNumber
        from dbo.VehicleControl vc with (nolock)
      ), latest as (
        select
          raw.*,
          row_number() over (
            partition by raw.KartNumber
            order by raw.DateControl desc, raw.Id_VehicleControl desc
          ) as RowNumber
        from raw
        where raw.KartNumber between 1 and 200
      )
      select
        latest.Number,
        latest.Quantity,
        latest.TimeofUse,
        latest.LastMaintenance,
        latest.StatusControl,
        latest.DateControl,
        transponder.OriginalNumber as SensorNumber
      from latest
      outer apply (
        select top 1 tr.OriginalNumber
        from dbo.TransponderRenumber tr with (nolock)
        where tr.NewNumber = latest.KartNumber
        order by tr.Id_TransponderRenumber desc
      ) transponder
      where latest.RowNumber = 1
      order by latest.KartNumber
    `);

    const rows = result.recordset.map(toFleetRow).filter((row): row is LapTimeKartFleetRow => row !== null);
    const unique = new Map(rows.map((row) => [row.numero, row] as const));
    return [...unique.values()];
  } finally {
    await pool.close().catch(() => undefined);
  }
}
