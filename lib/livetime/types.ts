export type LiveTimingStatus = 'live' | 'waiting' | 'empty' | 'error' | 'demo';

export type LiveTimingDriver = {
  position: number;
  kart: string;
  name: string;
  time: string;
};

export type LiveTimingSnapshot = {
  status: LiveTimingStatus;
  source: 'rest' | 'dom-scraper' | 'demo' | 'cache';
  updatedAt: string;
  eventName?: string;
  trackName?: string;
  message?: string;
  drivers: LiveTimingDriver[];
};

export type RawDriver = Record<string, unknown>;
