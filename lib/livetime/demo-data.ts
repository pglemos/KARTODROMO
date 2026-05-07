import type { LiveTimingDriver, LiveTimingSnapshot } from '@/lib/livetime/types';

export const DEFAULT_UID = '58856059-c4fd-4626-aea7-42aefc048eec';

export const DEMO_DRIVERS: LiveTimingDriver[] = Array.from({ length: 30 }, (_, index) => {
  const position = index + 1;
  const seconds = 33 + (index % 26);
  return {
    position,
    kart: String(100 + position),
    name: `PILOTO ${String(position).padStart(2, '0')}`,
    time: `00:${String(seconds).padStart(2, '0')}.${String(10 + position).padStart(3, '0')}`,
  };
});

export function createDemoSnapshot(message = 'Dados demonstrativos'): LiveTimingSnapshot {
  return {
    status: 'demo',
    source: 'demo',
    updatedAt: new Date().toISOString(),
    eventName: 'KARTODROMO',
    trackName: 'TELAO LED 2048x512',
    message,
    drivers: DEMO_DRIVERS,
  };
}
