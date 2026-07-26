import { beforeEach, describe, expect, it, vi } from 'vitest';
import PodioFinalTb50Page from './page';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { readTb50DisplayModeFromStore } from '@/lib/tb50-display-mode-store';
import type { LiveTimingSnapshot } from '@/lib/livetime/types';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/tb50-display-mode-store', () => ({
  readTb50DisplayModeFromStore: vi.fn(async () => ({ mode: 'live', auto: true, updatedAt: null, persistent: true })),
}));

vi.mock('@/lib/livetime/snapshot-cache', () => ({
  getLastSnapshot: vi.fn(() => null),
}));

vi.mock('@/lib/livetime/snapshot-service', () => ({
  fetchExternalSnapshot: vi.fn(),
}));

vi.mock('./FinalPodiumClient', () => ({
  DEFAULT_PODIUM_UID: 'test-uid',
  FinalPodiumClient: vi.fn(() => null),
}));

const liveSnapshot: LiveTimingSnapshot = {
  status: 'live',
  source: 'dom-scraper',
  updatedAt: '2026-05-24T13:00:00.000Z',
  sessionType: 'race',
  eventName: 'CORRIDA (Corrida) - Tracado 1',
  drivers: [{ position: 1, kart: '55', name: 'PILOTO 01', time: '1:01.000' }],
};

describe('/podio-final-tb50 display mode guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValue({ mode: 'live', auto: true, updatedAt: null, persistent: true });
    vi.mocked(fetchExternalSnapshot).mockResolvedValue(liveSnapshot);
  });

  it('redirects the standalone podium page back to the live scoreboard while display mode is live', async () => {
    await expect(PodioFinalTb50Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/placar-telao-tb50?layout=designer',
    );
  });

  it('keeps the podium page available when manual final-real mode has a finished race snapshot', async () => {
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValueOnce({
      mode: 'final-real',
      auto: true,
      updatedAt: '2026-05-24T13:00:00.000Z',
      persistent: true,
    });
    const finishedRaceSnapshot: LiveTimingSnapshot = {
      ...liveSnapshot,
      status: 'finished',
      updatedAt: '2026-05-24T13:20:00.000Z',
    };
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce(finishedRaceSnapshot);

    const element = await PodioFinalTb50Page({ searchParams: Promise.resolve({}) });

    expect(element.props.allowLiveSnapshot).toBe(true);
    expect(element.props.force).toBe(false);
    expect(element.props.initialSnapshot).toMatchObject(finishedRaceSnapshot);
  });

  it('redirects forced final previews while the race is still live', async () => {
    await expect(PodioFinalTb50Page({ searchParams: Promise.resolve({ force: 'true' }) })).rejects.toThrow(
      'NEXT_REDIRECT:/placar-telao-tb50?layout=designer',
    );
  });

  it('keeps forced final previews available for a finished race snapshot', async () => {
    const finishedRaceSnapshot: LiveTimingSnapshot = {
      ...liveSnapshot,
      status: 'finished',
      updatedAt: '2026-05-24T13:20:00.000Z',
    };
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce(finishedRaceSnapshot);

    const element = await PodioFinalTb50Page({ searchParams: Promise.resolve({ force: 'true' }) });

    expect(element.props.allowLiveSnapshot).toBe(true);
    expect(element.props.force).toBe(true);
    expect(element.props.initialSnapshot).toMatchObject(finishedRaceSnapshot);
  });

  it('keeps automatic podium available for a finished race snapshot', async () => {
    const finishedRaceSnapshot: LiveTimingSnapshot = {
      ...liveSnapshot,
      status: 'finished',
      updatedAt: '2026-05-24T13:20:00.000Z',
    };
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce(finishedRaceSnapshot);

    const element = await PodioFinalTb50Page({ searchParams: Promise.resolve({ auto: 'true' }) });

    expect(element.props.allowLiveSnapshot).toBe(false);
    expect(element.props.force).toBe(false);
    expect(element.props.initialSnapshot).toMatchObject(finishedRaceSnapshot);
  });

  it('redirects automatic podium back to the scoreboard when a new qualifying session starts', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      ...liveSnapshot,
      status: 'live',
      sessionType: 'qualifying',
      eventName: 'TOMADA DE TEMPO (Treino Classificatorio) - Tracado 1',
    });

    await expect(PodioFinalTb50Page({ searchParams: Promise.resolve({ auto: 'true' }) })).rejects.toThrow(
      'NEXT_REDIRECT:/placar-telao-tb50?layout=designer',
    );
  });

  it('redirects manual final-real mode back to the scoreboard for a finished qualifying snapshot', async () => {
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValueOnce({
      mode: 'final-real',
      auto: true,
      updatedAt: '2026-05-24T13:00:00.000Z',
      persistent: true,
    });
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      ...liveSnapshot,
      status: 'finished',
      sessionType: 'qualifying',
      eventName: 'TOMADA DE TEMPO (Treino Classificatorio) - Tracado 1',
    });

    await expect(PodioFinalTb50Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT:/placar-telao-tb50?layout=designer',
    );
  });
});
