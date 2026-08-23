export type LiveTimingStatus = 'live' | 'waiting' | 'empty' | 'error' | 'demo' | 'finished';
export type LiveTimingSessionType = 'race' | 'qualifying' | 'unknown';

export type LiveTimingDriver = {
  position: number;
  kart: string;
  name: string;
  /** Nome completo da equipe quando a fonte de cronometragem o disponibiliza. */
  team?: string;
  time: string;
};

export type LiveTimingSnapshot = {
  status: LiveTimingStatus;
  source: 'rest' | 'sql' | 'dom-scraper' | 'demo' | 'cache';
  updatedAt: string;
  sessionType?: LiveTimingSessionType;
  eventName?: string;
  trackName?: string;
  message?: string;
  drivers: LiveTimingDriver[];
};

export type RawDriver = Record<string, unknown>;
