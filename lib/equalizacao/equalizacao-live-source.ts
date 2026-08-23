import {
  PIT_RULES,
} from '@/lib/livetime/laptime-pit-stops';
import {
  fetchLapTimeRacingDetail,
  fetchLapTimeRacingsPage,
  type LapTimeRacingDetail,
} from '@/lib/livetime/laptime-racings';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';
import { normalizedKartNumber } from '@/lib/equalizacao/kart';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';
import type { EqualizacaoLiveCandidate, EqualizacaoLiveSnapshot } from './equalizacao-live.types';

const QUALIFYING_PATTERN = /tomada|qualific|classific|equaliza/i;
const CACHE_MS = 1_500;

let cachedSnapshot: { expiresAt: number; value: EqualizacaoLiveSnapshot } | null = null;
let inFlight: Promise<EqualizacaoLiveSnapshot> | null = null;

export function isQualifyingEqualizacaoRace(name: string, type: string | null): boolean {
  return QUALIFYING_PATTERN.test(`${name} ${type || ''}`);
}

function timeText(value: number | null): string | null {
  return value === null ? null : formatDurationMs(value);
}

export function toEqualizacaoLiveCandidate(detail: LapTimeRacingDetail, competitorId: string): EqualizacaoLiveCandidate | null {
  const competitor = detail.competitors.find((row) => row.id === competitorId);
  if (!competitor) return null;

  const plate = normalizedKartNumber(competitor.numero || competitor.transponder);
  if (plate === null || plate < 1 || plate > 200) return null;

  const laps = detail.laps
    .filter((row) => row.competitorId === competitorId)
    .sort((left, right) => Number(right.id) - Number(left.id));
  const normalLapTimes = laps
    .filter((lap) => !lap.invalida && !lap.excluida && !lap.parada)
    .map((lap) => parseDurationMs(lap.tempoVolta))
    .filter((value): value is number => value !== null && value > 0 && value < PIT_RULES.candidateStopMinMs);
  const averageMs = parseDurationMs(competitor.averageLap);
  const values = normalLapTimes.length ? normalLapTimes : averageMs === null ? [] : [averageMs];
  const mean = values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : averageMs;
  const deviationMs = values.length > 1 && mean !== null
    ? Math.round(Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length))
    : 0;
  const lastLap = laps.find((lap) => lap.tempoVolta && !lap.excluida)?.volta ?? null;
  const latest = laps.find((lap) => lap.tempoTotal || lap.tempoVolta);
  const raceTimeMs = parseDurationMs(latest?.tempoTotal || competitor.tempoTotal);

  return {
    competitorId,
    kart: String(plate),
    piloto: competitor.nome,
    transponder: competitor.transponder,
    melhorVoltaMs: parseDurationMs(competitor.melhorVolta),
    melhorVolta: competitor.melhorVolta,
    mediaVoltaMs: mean,
    mediaVolta: timeText(mean),
    desvioMs: values.length ? deviationMs : null,
    desvio: values.length ? timeText(deviationMs) : null,
    voltasValidas: normalLapTimes.length || competitor.normalLaps || competitor.validLaps || 0,
    ultimaVolta: lastLap,
    tempoCorridaMs: raceTimeMs,
    tempoCorrida: timeText(raceTimeMs),
    ultimaPassagemId: latest?.id || null,
  };
}

function noQualifyingSnapshot(status: EqualizacaoLiveSnapshot['status'] = 'no-qualifying'): EqualizacaoLiveSnapshot {
  return {
    status,
    source: 'laptime',
    atualizadoEm: new Date().toISOString(),
    race: null,
    candidates: [],
  };
}

async function readSnapshot(options: LapTimeSqlOptions): Promise<EqualizacaoLiveSnapshot> {
  const { rows } = await fetchLapTimeRacingsPage(options, { status: 'aberta', limit: 100 });
  const race = rows
    .filter((row) => row.situacao === 'em_andamento' && row.inicio && isQualifyingEqualizacaoRace(row.nome, row.tipo))
    .sort((left, right) => new Date(right.inicio || right.dataHora).getTime() - new Date(left.inicio || left.dataHora).getTime())[0];

  if (!race) return noQualifyingSnapshot();

  const detail = await fetchLapTimeRacingDetail(options, race.id);
  if (!detail || detail.race.finalizada || detail.race.situacao !== 'em_andamento') return noQualifyingSnapshot();

  const candidates = detail.competitors
    .map((competitor) => toEqualizacaoLiveCandidate(detail, competitor.id))
    .filter((candidate): candidate is EqualizacaoLiveCandidate => Boolean(candidate))
    .sort((left, right) => (left.melhorVoltaMs ?? Number.MAX_SAFE_INTEGER) - (right.melhorVoltaMs ?? Number.MAX_SAFE_INTEGER));

  return {
    status: 'online',
    source: 'laptime',
    atualizadoEm: new Date().toISOString(),
    race: {
      id: detail.race.id,
      nome: detail.race.nome,
      tipo: detail.race.tipo,
      pista: detail.race.pista,
      inicio: detail.race.inicio,
    },
    candidates,
  };
}

export function fetchEqualizacaoLiveSnapshot(options: LapTimeSqlOptions): Promise<EqualizacaoLiveSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) return Promise.resolve(cachedSnapshot.value);
  if (inFlight) return inFlight;

  inFlight = readSnapshot(options)
    .then((value) => {
      cachedSnapshot = { value, expiresAt: Date.now() + CACHE_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
