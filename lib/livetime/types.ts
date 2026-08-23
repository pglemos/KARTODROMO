export type LiveTimingStatus = 'live' | 'waiting' | 'empty' | 'error' | 'demo' | 'finished';
export type LiveTimingSessionType = 'race' | 'qualifying' | 'unknown';

export type LiveTimingPitStopStatus = 'mandatory' | 'additional' | 'short' | 'invalid' | 'outside-window';

export type LiveTimingPitStop = {
  id: string;
  lap: number | null;
  stopTime: string | null;
  raceTime: string | null;
  position: number | null;
  status: LiveTimingPitStopStatus;
  mandatoryNumber?: number;
};

export type LiveTimingPitSummary = {
  required: number;
  minimumStopMs: number;
  currentLap: number | null;
  currentRaceTime: string | null;
  currentRaceTimeMs: number | null;
  mandatory: number;
  remaining: number;
  short: number;
  total: number;
  additional: number;
  excess: number;
  penaltyLaps: number;
  outsideWindow: number;
  stops: LiveTimingPitStop[];
};

export type LiveTimingRace = {
  id: string;
  name: string;
  type: string | null;
  state: number;
  startedAt: string | null;
  rules: {
    requiredStops: number;
    minimumStopMs: number;
    additionalStopsAllowed: number;
    candidateStopMinMs: number;
    penaltyLapsPerStop: number;
    boxOpenAfterMs: number;
    boxCloseAfterMs: number;
  };
};

export type LiveTimingDriver = {
  position: number;
  kart: string;
  name: string;
  /** Nome completo da equipe quando a fonte de cronometragem o disponibiliza. */
  team?: string;
  time: string;
  pitStops?: LiveTimingPitSummary;
};

export type LiveTimingSnapshot = {
  status: LiveTimingStatus;
  source: 'rest' | 'sql' | 'dom-scraper' | 'demo' | 'cache';
  updatedAt: string;
  sessionType?: LiveTimingSessionType;
  eventName?: string;
  trackName?: string;
  message?: string;
  race?: LiveTimingRace;
  drivers: LiveTimingDriver[];
};

export type RawDriver = Record<string, unknown>;
