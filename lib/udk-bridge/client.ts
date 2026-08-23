// Cliente Supabase do UDK (service_role) para criar/atualizar resultados em
// DRAFT com idempotência por source_system + external_racing_id.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DriverMatchIndex } from '@/lib/udk-bridge/driver-match';
import type {
  UdkBridgeConfig,
  UdkImportBatchDraft,
  UdkResultDraft,
  UdkResultEntryDraft,
} from '@/lib/udk-bridge/types';

export type UdkClientOptions = {
  url?: string;
  serviceRoleKey?: string;
  // Client injetável (testes): quando fornecido, ignora url/key.
  client?: SupabaseClient;
};

export type UpsertOutcome =
  | { kind: 'created'; resultId: string; entriesInserted: number; entriesUpdated: number }
  | { kind: 'updated'; resultId: string; entriesInserted: number; entriesUpdated: number }
  | { kind: 'skipped'; reason: string };

export type SyncRaceOutcome = {
  racingId: number;
  result: UpsertOutcome;
  batchId?: string;
};

export class UdkClient {
  private readonly client: SupabaseClient;

  constructor(options: UdkClientOptions) {
    if (options.client) {
      this.client = options.client;
    } else if (options.url && options.serviceRoleKey) {
      this.client = createClient(options.url, options.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    } else {
      throw new Error('UdkClient: informe url+serviceRoleKey ou client injetável');
    }
  }

  async findResultByExternalRacing(racingId: number): Promise<{ id: string; version: number } | null> {
    const { data, error } = await this.client
      .from('results')
      .select('id, version')
      .eq('source_system', 'laptime')
      .eq('external_racing_id', racingId)
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? { id: data[0].id, version: data[0].version } : null;
  }

  async listEntries(resultId: string): Promise<Map<number, string>> {
    const { data, error } = await this.client
      .from('result_entries')
      .select('id, external_competitor_id')
      .eq('result_id', resultId)
      .is('deleted_at', null);

    if (error) throw error;
    const map = new Map<number, string>();
    for (const entry of data || []) {
      if (entry.external_competitor_id != null) map.set(Number(entry.external_competitor_id), entry.id);
    }
    return map;
  }

  async listDrivers(config: UdkBridgeConfig): Promise<DriverMatchIndex> {
    const { data, error } = await this.client
      .from('drivers')
      .select('id, number, full_name, sport_name')
      .eq('season_id', config.seasonId)
      .is('deleted_at', null)
      .in('status', ['approved', 'pending']);

    if (error) throw error;
    return new DriverMatchIndex(
      (data || []).map((driver) => ({
        id: driver.id,
        number: driver.number != null ? Number(driver.number) : null,
        name: driver.full_name || driver.sport_name || null,
      })),
    );
  }

  async upsertResultDraft(payload: UdkResultDraft): Promise<UpsertOutcome> {
    const existing = await this.findResultByExternalRacing(payload.external_racing_id);

    if (existing) {
      const { error } = await this.client
        .from('results')
        .update({
          stage_id: payload.stage_id,
          session_id: payload.session_id,
          title: payload.title,
          fastest_lap_ms: payload.fastest_lap_ms,
          external_imported_at: payload.external_imported_at,
        })
        .eq('id', existing.id);
      if (error) throw error;
      return { kind: 'updated', resultId: existing.id, entriesInserted: 0, entriesUpdated: 0 };
    }

    const { data, error } = await this.client
      .from('results')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      // Conflito de corrida já importada por outra execução (unique index).
      if (error.code === '23505') {
        const found = await this.findResultByExternalRacing(payload.external_racing_id);
        if (found) {
          return { kind: 'skipped', reason: 'já importada (conflito único) → reutilizada' };
        }
      }
      throw error;
    }

    return { kind: 'created', resultId: data.id, entriesInserted: 0, entriesUpdated: 0 };
  }

  async syncEntries(
    resultId: string,
    entries: UdkResultEntryDraft[],
    drivers: DriverMatchIndex,
    minScore = 0.8,
  ): Promise<{ inserted: number; updated: number; unmatched: number }> {
    const existing = await this.listEntries(resultId);
    let inserted = 0;
    let updated = 0;
    let unmatched = 0;

    for (const entry of entries) {
      const resolved = entry.driver_id
        ? { id: entry.driver_id, via: 'kart' as const, score: 1 }
        : drivers.resolve(entry.kart_number, entry.driver_name, minScore);

      if (!resolved.id) {
        unmatched += 1;
        console.warn(
          `[udk-bridge] piloto não mapeado: kart #${entry.kart_number ?? '?'} nome "${entry.driver_name ?? ''}" posição ${entry.position} (external_competitor_id=${entry.external_competitor_id})`,
        );
        continue;
      }

      if (resolved.via === 'name' && resolved.score < 1) {
        console.warn(
          `[udk-bridge] piloto vinculado por nome com confiança ${resolved.score.toFixed(2)}: "${entry.driver_name}" (kart #${entry.kart_number ?? '?'}) → ${resolved.id}`,
        );
      }

      const driverId = resolved.id;

      const row = {
        driver_id: driverId,
        position: entry.position,
        kart_number: entry.kart_number,
        laps: entry.laps,
        total_time_ms: entry.total_time_ms,
        best_lap_ms: entry.best_lap_ms,
        penalty_ms: entry.penalty_ms ?? 0,
        status: entry.status,
        pole: entry.pole ?? false,
        fastest_lap: entry.fastest_lap ?? false,
        external_competitor_id: entry.external_competitor_id ?? null,
      };

      const existingEntryId =
        entry.external_competitor_id != null ? existing.get(Number(entry.external_competitor_id)) : undefined;

      if (existingEntryId) {
        const { error } = await this.client.from('result_entries').update(row).eq('id', existingEntryId);
        if (error) throw error;
        updated += 1;
      } else {
        const { error } = await this.client.from('result_entries').insert({ ...row, result_id: resultId });
        if (error) throw error;
        inserted += 1;
      }
    }

    return { inserted, updated, unmatched };
  }

  async createImportBatch(payload: UdkImportBatchDraft): Promise<string> {
    const { data, error } = await this.client.from('import_batches').insert(payload).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async syncRace(
    racingId: number,
    payload: UdkResultDraft,
    entries: UdkResultEntryDraft[],
    drivers: DriverMatchIndex,
    diagnostics: Record<string, unknown>,
    minScore = 0.8,
  ): Promise<SyncRaceOutcome> {
    const result = await this.upsertResultDraft(payload);

    if (result.kind === 'created' || result.kind === 'updated') {
      const sync = await this.syncEntries(result.resultId, entries, drivers, minScore);
      const batchId = await this.createImportBatch({
        stage_id: payload.stage_id,
        source: 'laptime',
        status: 'imported',
        confidence: diagnostics.confidence == null ? 1 : Number(diagnostics.confidence),
        diagnostics,
      });
      return { racingId, result: { ...result, entriesInserted: sync.inserted, entriesUpdated: sync.updated }, batchId };
    }

    return { racingId, result };
  }
}

export function createUdkClient(options: UdkClientOptions): UdkClient {
  return new UdkClient(options);
}