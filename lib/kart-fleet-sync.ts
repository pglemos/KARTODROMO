import { BRIDGE_FETCH_HEADERS, resolveBridgeBase } from './bridge-base';
import type { AdminD1Database, AdminD1Statement } from './admin-d1';
import { normalizedKartNumber } from './equalizacao/kart';
import type { LapTimeKartFleetRow } from './livetime/kart-fleet';

type D1KartRow = {
  id: string;
  numero: string;
  modelo: string | null;
  motor: string | null;
  km_total: number | null;
  status: string | null;
  ativo: number | boolean | null;
  notes: string | null;
  chassi_numero: string | null;
  sensor_numero: string | null;
  sensor_numero_fonte: string | null;
  redutor_antigo: string | null;
  redutor_novo: string | null;
  proxima_manutencao: string | null;
  data_source: string | null;
};

const SEEDED_MODELS = new Set(['Birel Art N35', 'CRG Road Rebel', 'Tony Kart Racer 401R', 'Kart Aluguel']);

function clean(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function canonicalPlate(value: unknown): string | null {
  const number = normalizedKartNumber(value);
  if (number === null || number < 1 || number > 200) return null;
  return number < 100 ? String(number).padStart(2, '0') : String(number);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function fetchFleet(): Promise<LapTimeKartFleetRow[]> {
  const base = resolveBridgeBase();
  if (!base) throw new Error('laptime_bridge_not_configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(Number(process.env.KARTODROMO_LOCAL_API_TIMEOUT_MS || 8000), 5000));
  try {
    const response = await fetch(`${base}/api/laptime-kart-fleet`, {
      headers: BRIDGE_FETCH_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`laptime_fleet_http_${response.status}`);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error('laptime_fleet_invalid_response');
    return body as LapTimeKartFleetRow[];
  } finally {
    clearTimeout(timeout);
  }
}

export type KartFleetSyncResult = {
  ok: boolean;
  count: number;
  error?: string;
};

/**
 * Makes the LapTime fleet authoritative for the list shown in Equalizacao.
 * Local fields (chassi, redutor, notes and equalization measurements) are
 * preserved; operational values from the source are refreshed on every read.
 */
export async function syncKartFleetFromLiveSource(db: AdminD1Database): Promise<KartFleetSyncResult> {
  let fleet: LapTimeKartFleetRow[];
  try {
    fleet = await fetchFleet();
  } catch (error) {
    return { ok: false, count: 0, error: error instanceof Error ? error.message : 'laptime_fleet_unavailable' };
  }

  const validFleet = fleet
    .map((row) => ({ ...row, numero: canonicalPlate(row.numero) }))
    .filter((row): row is LapTimeKartFleetRow & { numero: string } => row.numero !== null);
  if (!validFleet.length) return { ok: false, count: 0, error: 'laptime_fleet_empty' };

  const existingResult = await db.prepare(`
    SELECT id, numero, modelo, motor, km_total, status, ativo, notes,
           chassi_numero, sensor_numero, sensor_numero_fonte,
           redutor_antigo, redutor_novo, proxima_manutencao, data_source
    FROM karts
  `).all<D1KartRow>();
  const existingByPlate = new Map<string, D1KartRow>();
  for (const row of existingResult.results) {
    const plate = canonicalPlate(row.numero);
    if (plate && !existingByPlate.has(plate)) existingByPlate.set(plate, row);
  }

  const statements: AdminD1Statement[] = [];
  const seenIds = new Set<string>();
  const now = new Date().toISOString();

  for (const source of validFleet) {
    const previous = existingByPlate.get(source.numero) || null;
    const id = previous?.id || `kart-laptime-${source.numero}`;
    const model = previous && !SEEDED_MODELS.has(clean(previous.modelo)) ? previous.modelo : 'Não informado';
    const motor = previous && !SEEDED_MODELS.has(clean(previous.modelo)) ? previous.motor : null;
    const status = source.statusControle === 1 ? 'manutencao' : 'disponivel';
    seenIds.add(id);

    if (previous) {
      statements.push(
        db.prepare(`
          UPDATE karts SET
            numero = ?, categoria = ?, modelo = ?, motor = ?, status = ?, km_total = ?,
            ultima_manutencao = ?, ativo = 1, laptime_quantity = ?, laptime_time_of_use_ms = ?,
            laptime_status_control = ?, laptime_updated_at = ?, sensor_numero_fonte = ?,
            sensor_fonte_atualizado_em = ?, data_source = 'laptime'
          WHERE id = ?
        `).bind(
          source.numero,
          source.categoria === 'super' ? 'super' : 'adulto',
          model || 'Não informado',
          motor,
          status,
          SEEDED_MODELS.has(clean(previous.modelo)) ? 0 : (previous.km_total ?? 0),
          source.ultimaManutencao,
          source.usoQuantidade,
          source.tempoUsoMs,
          source.statusControle,
          source.observadoEm,
          source.sensorNumeroFonte,
          source.observadoEm,
          id,
        ),
      );
    } else {
      statements.push(
        db.prepare(`
          INSERT INTO karts (
            id, numero, modelo, categoria, motor, status, km_total, ultima_manutencao,
            proxima_manutencao, notes, ativo, created_at, laptime_quantity,
            laptime_time_of_use_ms, laptime_status_control, laptime_updated_at,
            sensor_numero_fonte, sensor_fonte_atualizado_em, data_source
          ) VALUES (?, ?, 'Não informado', ?, NULL, ?, 0, ?, NULL, NULL, 1, ?, ?, ?, ?, ?, ?, ?, 'laptime')
        `).bind(
          id,
          source.numero,
          source.categoria === 'super' ? 'super' : 'adulto',
          status,
          source.ultimaManutencao,
          now,
          source.usoQuantidade,
          source.tempoUsoMs,
          source.statusControle,
          source.observadoEm,
          source.sensorNumeroFonte,
          source.observadoEm,
        ),
      );
    }

    const previousSensor = clean(previous?.sensor_numero_fonte);
    const sourceSensor = clean(source.sensorNumeroFonte);
    if (sourceSensor && sourceSensor !== previousSensor) {
      statements.push(
        db.prepare(`
          INSERT INTO karts_identidade_historico (
            id, kart_id, data, acao, chassi_anterior, chassi_novo,
            placa_anterior, placa_nova, sensor_anterior, sensor_novo,
            observacoes, responsavel
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          id,
          now,
          previousSensor ? 'troca_identidade' : 'cadastro',
          previous?.chassi_numero || null,
          previous?.chassi_numero || null,
          previous?.numero || null,
          source.numero,
          previousSensor || null,
          sourceSensor,
          'Sincronizado da relação TransponderRenumber do LapTime.',
          'LapTime',
        ),
      );
    }
  }

  for (const row of existingResult.results) {
    if (seenIds.has(row.id)) continue;
    statements.push(
      db.prepare(`UPDATE karts SET ativo = 0, status = 'inativo' WHERE id = ?`).bind(row.id),
    );
  }

  for (const batch of chunk(statements, 50)) await db.batch(batch);
  return { ok: true, count: validFleet.length };
}
