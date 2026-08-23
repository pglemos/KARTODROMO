// Sincronização ULTRAS → UDK. Lê corridas finalizadas do LapTime, filtra pelo
// campeonato ULTRAS (whitelist + texto), transforma e envia como DRAFT.
// NUNCA publica: o resultado chega como 'draft' e aguarda homologação.
import { fetchFinishedUltrasRacings, type LapTimeSqlSource } from '@/lib/udk-bridge/laptime-reader';
import type { UdkClient } from '@/lib/udk-bridge/client';
import { bridgeSummary, buildEntriesDraft, buildResultDraft, enduranceRacing, fastestLapMillis, markFastestLap } from '@/lib/udk-bridge/transform';
import type { UdkBridgeConfig } from '@/lib/udk-bridge/types';
import type { UltrasFilterOptions } from '@/lib/livetime/ultras-filter';

export type UdkBridgeSyncResult = {
  scanned: number;
  imported: number;
  skipped: number;
  failures: Array<{ racingId: number; error: string }>;
};

export async function syncFinishedUltrasToUdk(options: {
  sqlSource: LapTimeSqlSource;
  config: UdkBridgeConfig;
  udk: UdkClient;
  filter?: UltrasFilterOptions;
}): Promise<UdkBridgeSyncResult> {
  const { sqlSource, config, udk, filter } = options;
  const result: UdkBridgeSyncResult = { scanned: 0, imported: 0, skipped: 0, failures: [] };

  const races = await fetchFinishedUltrasRacings(sqlSource, filter);
  result.scanned = races.length;

  const drivers = await udk.listDrivers(config);
  console.log(
    `[udk-bridge] pilotos UDK: ${drivers.size} cadastrados (${drivers.byNumber.size} com kart) — fallback por nome com confiança mínima ${config.nameMatchMinScore ?? 0.8}`,
  );

  for (const race of races) {
    const racingId = race.racing.Id_Racing;
    try {
      const summary = bridgeSummary(race, config);

      if (!race.finishedByFlag) {
        console.warn(`[udk-bridge] #${racingId} finalizada sem bandeira de encerramento — pulando`);
        result.skipped += 1;
        continue;
      }

      if (race.competitors.length === 0) {
        console.warn(`[udk-bridge] #${racingId} sem competidores — pulando`);
        result.skipped += 1;
        continue;
      }

      const endurance = enduranceRacing(race.competitors);
      const payload = buildResultDraft(race.racing, config);
      const entries = markFastestLap(buildEntriesDraft(race.competitors), race.competitors);
      const fastest = fastestLapMillis(race.competitors);

      const synced = await udk.syncRace(racingId, { ...payload, fastest_lap_ms: fastest }, entries, drivers, {
        ...summary,
        endurance,
        syncedAt: new Date().toISOString(),
      }, config.nameMatchMinScore ?? 0.8);

      console.log(
        `[udk-bridge] #${racingId} "${payload.title}": ${synced.result.kind}${synced.result.kind === 'updated' ? ` (${synced.result.entriesInserted} inseridas, ${synced.result.entriesUpdated} atualizadas)` : ''} batch=${synced.batchId || '-'}`,
      );
      result.imported += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);
      console.error(`[udk-bridge] #${racingId} falhou: ${message}`);
      result.failures.push({ racingId, error: message });
    }
  }

  return result;
}