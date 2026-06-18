import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { fetchExternalSnapshot } from '@/lib/livetime/snapshot-service';
import { clearSnapshotCacheForTests } from '@/lib/livetime/snapshot-cache';
import { readTb50DisplayModeFromStore } from '@/lib/tb50-display-mode-store';
import { readTb50PageFromRemote } from '@/lib/tb50-page-store';

vi.mock('@/lib/telao-layout-store', () => ({
  readTelaoLayoutConfigFromRemote: vi.fn(async () => ({
    id: 'custom-test',
    label: 'Custom test',
    variant: 'cards',
    columns: 2,
    rows: 1,
    fields: ['position', 'kart'],
    nameMode: 'hidden',
    showHeader: false,
    positionFontSize: 20,
    kartFontSize: 22,
    nameFontSize: 18,
    timeFontSize: 18,
    headerFontSize: 18,
    cellGap: 0,
    borderWidth: 1,
    lineWidth: 2,
    colors: {
      background: '#123456',
      grid: '#abcdef',
      accent: '#00ff00',
      text: '#ffffff',
      position: '#ffff00',
      time: '#ffffff',
      muted: 'rgba(255,255,255,.2)',
      topCell: '#123456',
      bottomCell: '#123456',
    },
  })),
}));

vi.mock('@/lib/livetime/snapshot-service', () => ({
  fetchExternalSnapshot: vi.fn(),
}));

vi.mock('@/lib/tb50-display-mode-store', () => ({
  readTb50DisplayModeFromStore: vi.fn(async () => ({ mode: 'live', updatedAt: null, persistent: true })),
}));

vi.mock('@/lib/tb50-page-store', () => ({
  readTb50PageFromRemote: vi.fn(async () => ({ offset: 0, updatedAt: null, persistent: true })),
}));

describe('/placar-telao-tb50 layout selection', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    clearSnapshotCacheForTests();
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValue({ mode: 'live', updatedAt: null, persistent: true });
    vi.mocked(readTb50PageFromRemote).mockResolvedValue({ offset: 0, updatedAt: null, persistent: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the saved designer layout when no layout is requested', async () => {
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?demo=true&_format=json'));
    const data = await response.json();

    expect(data.css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(data.css).toContain('background:#123456');
    expect(data.content).toContain('class="kart"');
    expect(data.content).not.toContain('class="time"');
    expect(data.css).not.toContain('.leader.kart');
    expect(data.css).not.toContain('.card.leader');
  });

  it('treats the legacy standard layout parameter as the saved designer layout', async () => {
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?demo=true&_format=json&layout=standard-30'));
    const data = await response.json();

    expect(data.css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(data.css).toContain('background:#123456');
  });

  it('keeps a finished timing session on the grid unless final race mode is requested', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-09T12:00:00.000Z',
      drivers: [
        { position: 1, kart: '101', name: 'PILOTO 01', time: '00:33.101' },
        { position: 2, kart: '102', name: 'PILOTO 02', time: '00:33.202' },
        { position: 3, kart: '103', name: 'PILOTO 03', time: '00:33.303' },
        { position: 4, kart: '104', name: 'PILOTO 04', time: '00:33.404' },
        { position: 5, kart: '105', name: 'PILOTO 05', time: '00:33.505' },
        { position: 6, kart: '106', name: 'PILOTO 06', time: '00:33.606' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.header).toBe('');
    expect(data.content).not.toContain('final-race-stage');
    expect(data.css).not.toContain('final-scene-leaderboard');
    expect(data.content).toContain('class="cards"');
    expect(data.content).toContain('101');
    expect(data.content).toContain('102');
  });

  it('redirects a finished race leaderboard to the final podium automatically', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-24T13:58:48.717Z',
      sessionType: 'race',
      eventName: 'Leaderboard',
      drivers: [
        { position: 1, kart: '15', name: 'PILOTO 01', time: '00:33.101' },
        { position: 2, kart: '13', name: 'PILOTO 02', time: '00:33.202' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(true);
    expect(data.header).toBe('');
    expect(data.content).toContain('final-race-frame-stage');
  });

  it('redirects a finished race page request to the automatic podium page', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-24T13:58:48.717Z',
      sessionType: 'race',
      eventName: 'Leaderboard',
      drivers: [{ position: 1, kart: '15', name: 'PILOTO 01', time: '00:33.101' }],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50'));
    const html = await response.text();

    expect(html).toContain('/podio-final-tb50?uid=58856059-c4fd-4626-aea7-42aefc048eec&auto=true');
    expect(html).toContain("location.replace('/podio-final-tb50?uid=58856059-c4fd-4626-aea7-42aefc048eec&auto=true')");
  });

  it('treats final=live as an explicit live scoreboard request', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-24T13:58:48.717Z',
      sessionType: 'race',
      eventName: 'Leaderboard',
      drivers: [{ position: 1, kart: '15', name: 'PILOTO 01', time: '00:33.101' }],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?final=live&_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.content).toContain('class="cards"');
    expect(data.content).toContain('15');
    expect(data.content).not.toContain('final-race-frame-stage');
  });

  it('redirects to the final podium from a finished race handoff with the last race grid', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:05.000Z'));

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:00.000Z',
        sessionType: 'race',
        eventName: 'BATERIA 1 (Corrida) - Tracado 1',
        drivers: [
          { position: 1, kart: '55', name: 'PILOTO RACE 01', time: '00:33.101' },
          { position: 2, kart: '73', name: 'PILOTO RACE 02', time: '00:34.202' },
        ],
      })
      .mockResolvedValueOnce({
        status: 'finished',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:08.000Z',
        sessionType: 'race',
        eventName: 'BATERIA 1 (Corrida) - Tracado 1',
        message: 'Corrida finalizada',
        drivers: [],
      });

    await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    vi.setSystemTime(new Date('2026-05-09T12:00:08.000Z'));
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(true);
    expect(data.content).toContain('final-race-frame-stage');
  });

  it('keeps the saved designer fields when the real result view has no kart numbers', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-12T12:00:00.000Z',
      sessionType: 'qualifying',
      eventName: 'Treino classificatorio - Tomada de tempo',
      drivers: [
        { position: 1, kart: '', name: 'LEONARDO FIGUEIREDO', time: '1:18.460' },
        { position: 2, kart: '', name: 'MARCOS SIDNEY', time: '1:19.081' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.contentUsable).toBe(false);
    expect(data.content).toContain('class="kart"');
    expect(data.content).not.toContain('LEONARDO FIGUEIREDO');
    expect(data.content).not.toContain('1:18.460');
    expect(data.content).not.toContain('class="name"');
    expect(data.content).not.toContain('class="time"');
  });

  it('keeps the last designer-compatible grid when a qualifying result loses kart numbers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:05.000Z'));

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-12T12:00:00.000Z',
        sessionType: 'qualifying',
        eventName: 'Treino classificatorio - Tomada de tempo',
        drivers: [
          { position: 1, kart: '201', name: 'PILOTO QUALI 01', time: '1:18.460' },
          { position: 2, kart: '202', name: 'PILOTO QUALI 02', time: '1:19.081' },
        ],
      })
      .mockResolvedValueOnce({
        status: 'finished',
        source: 'dom-scraper',
        updatedAt: '2026-05-12T12:05:00.000Z',
        sessionType: 'qualifying',
        eventName: 'Treino classificatorio - Tomada de tempo',
        message: 'Tomada encerrada',
        drivers: [
          { position: 1, kart: '', name: 'LEONARDO FIGUEIREDO', time: '1:18.460' },
          { position: 2, kart: '', name: 'MARCOS SIDNEY', time: '1:19.081' },
        ],
      });

    await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    vi.setSystemTime(new Date('2026-05-12T12:00:09.000Z'));
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.contentUsable).toBe(true);
    expect(data.content).toContain('class="kart"');
    expect(data.content).toContain('201');
    expect(data.content).toContain('202');
    expect(data.content).not.toContain('LEONARDO FIGUEIREDO');
    expect(data.content).not.toContain('1:18.460');
    expect(data.content).not.toContain('final-race-stage');
  });

  it('keeps a manual final-real request on the grid for qualifying data', async () => {
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValueOnce({ mode: 'final-real', updatedAt: '2026-05-12T12:00:00.000Z', persistent: true });
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-12T12:00:00.000Z',
      sessionType: 'qualifying',
      eventName: 'Treino classificatorio - Tomada de tempo',
      drivers: [
        { position: 1, kart: '', name: 'LEONARDO FIGUEIREDO', time: '1:18.460' },
        { position: 2, kart: '', name: 'MARCOS SIDNEY', time: '1:19.081' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.content).not.toContain('final-race-frame-stage');
  });

  it('renders the selected TB50 page offset in 10-position steps', async () => {
    vi.mocked(readTb50PageFromRemote).mockResolvedValueOnce({ offset: 10, updatedAt: '2026-05-12T12:00:00.000Z', persistent: true });
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'live',
      source: 'dom-scraper',
      updatedAt: '2026-05-12T12:00:00.000Z',
      drivers: [
        { position: 1, kart: '101', name: 'PILOTO 01', time: '1:01.000' },
        { position: 2, kart: '102', name: 'PILOTO 02', time: '1:02.000' },
        { position: 11, kart: '211', name: 'PILOTO 11', time: '1:11.000' },
        { position: 12, kart: '212', name: 'PILOTO 12', time: '1:12.000' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.page).toMatchObject({ offset: 10, start: 11, end: 12 });
    expect(data.content).toContain('211');
    expect(data.content).toContain('212');
    expect(data.content).not.toContain('101');
    expect(data.content).not.toContain('102');
  });

  it('falls back to the first page when the saved TB50 page is beyond the current timing list', async () => {
    vi.mocked(readTb50PageFromRemote).mockResolvedValueOnce({ offset: 30, updatedAt: '2026-05-17T12:00:00.000Z', persistent: true });
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'live',
      source: 'dom-scraper',
      updatedAt: '2026-05-17T12:00:00.000Z',
      drivers: [
        { position: 1, kart: '16', name: 'FABRICIO FILIPE SANTOS', time: '1:01.000' },
        { position: 2, kart: '59', name: 'FELIPE FERREIRA CARDOSO', time: '1:02.000' },
        { position: 30, kart: '88', name: 'PILOTO 30', time: '1:30.000' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.page).toMatchObject({ offset: 0, start: 1, end: 2 });
    expect(data.content).toContain('16');
    expect(data.content).toContain('59');
    expect(data.content).not.toContain('31');
  });

  it('supports final preview mode with demo results', async () => {
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json&final=true'));
    const data = await response.json();

    expect(data.header).toBe('');
    expect(data.finalRedirect).toBe(true);
    expect(data.content).toContain('final-race-frame-stage');
    expect(data.content).toContain('/final-race-frames/frame-000.jpg');
    expect(data.content).not.toContain('/final-race-video.mp4');
    expect(data.content).not.toContain('final-race-code-stage');
    expect(data.content).not.toContain('final-video-data');
  });

  it('can force the final race video with current real snapshot data', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-09T12:00:00.000Z',
      sessionType: 'race',
      eventName: 'BATERIA 1 (Corrida) - Tracado 1',
      drivers: [
        { position: 1, kart: '55', name: 'KENNEDY ALVES KEA', time: '01:20.751' },
        { position: 2, kart: '73', name: 'ESDRAS ANDRADE ESD', time: '01:19.158' },
        { position: 3, kart: '4', name: 'BERNARD PEREIRA LEMOS BER', time: '01:24.114' },
        { position: 4, kart: '71', name: 'LUCAS MIRANDA RODRIGUES VILELA LUC', time: '01:24.331' },
        { position: 5, kart: '80', name: 'FELIPE ALMEIDA FEL', time: '01:24.846' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json&final=real'));
    const data = await response.json();

    expect(data.header).toBe('');
    expect(data.finalRedirect).toBe(true);
    expect(data.content).toContain('final-race-frame-stage');
    expect(data.content).toContain('/final-race-frames/frame-000.jpg');
    expect(data.content).not.toContain('/final-race-video.mp4');
    expect(data.content).not.toContain('/final-race-video-original.mp4');
    expect(data.content).not.toContain('KENNEDY ALVES KEA');
    expect(data.content).not.toContain('01:24.846');
  });

  it('redirects final=real previews to the real forced podium page', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-09T12:00:00.000Z',
      sessionType: 'race',
      eventName: 'BATERIA 1 (Corrida) - Tracado 1',
      drivers: [{ position: 1, kart: '55', name: 'KENNEDY ALVES KEA', time: '01:20.751' }],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?final=real'));
    const html = await response.text();

    expect(html).toContain('/podio-final-tb50?uid=58856059-c4fd-4626-aea7-42aefc048eec&force=true');
    expect(html).toContain("location.replace('/podio-final-tb50?uid=58856059-c4fd-4626-aea7-42aefc048eec&force=true')");
  });

  it('keeps final=real on the live grid while the race is still live', async () => {
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'live',
      source: 'dom-scraper',
      updatedAt: '2026-05-09T12:00:00.000Z',
      sessionType: 'race',
      eventName: 'BATERIA 1 (Corrida) - Tracado 1',
      drivers: [
        { position: 1, kart: '55', name: 'KENNEDY ALVES KEA', time: '01:20.751' },
        { position: 2, kart: '73', name: 'ESDRAS ANDRADE ESD', time: '01:21.158' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json&final=real'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.content).toContain('class="cards"');
    expect(data.content).toContain('55');
    expect(data.content).not.toContain('final-race-frame-stage');
  });

  it('can switch to final video from the manual display mode without a final query param', async () => {
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValueOnce({ mode: 'final-real', updatedAt: '2026-05-09T12:00:00.000Z', persistent: true });
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'finished',
      source: 'dom-scraper',
      updatedAt: '2026-05-09T12:00:00.000Z',
      sessionType: 'race',
      eventName: 'BATERIA 1 (Corrida) - Tracado 1',
      drivers: [{ position: 1, kart: '55', name: 'KENNEDY ALVES KEA', time: '01:20.751' }],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.header).toBe('');
    expect(data.finalRedirect).toBe(true);
    expect(data.content).toContain('final-race-frame-stage');
    expect(data.content).toContain('/final-race-frames/frame-000.jpg');
    expect(data.content).not.toContain('/final-race-video.mp4');
    expect(data.content).not.toContain('final-video-data');
    expect(data.content).not.toContain('final-race-video-original.mp4');
    expect(data.content).not.toContain('KENNEDY ALVES KEA');
  });

  it('keeps manual final-real mode on the grid during a live race', async () => {
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValueOnce({ mode: 'final-real', updatedAt: '2026-05-09T12:00:00.000Z', persistent: true });
    vi.mocked(fetchExternalSnapshot).mockResolvedValueOnce({
      status: 'live',
      source: 'dom-scraper',
      updatedAt: '2026-05-09T12:00:00.000Z',
      sessionType: 'race',
      eventName: 'BATERIA 1 (Corrida) - Tracado 1',
      drivers: [
        { position: 1, kart: '55', name: 'KENNEDY ALVES KEA', time: '01:20.751' },
        { position: 2, kart: '73', name: 'ESDRAS ANDRADE ESD', time: '01:21.158' },
      ],
    });

    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.content).toContain('class="cards"');
    expect(data.content).toContain('55');
    expect(data.content).not.toContain('final-race-frame-stage');
  });

  it('keeps the last grid when LiveTime closes a session and returns no drivers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:05.000Z'));

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:00.000Z',
        drivers: [
          { position: 1, kart: '201', name: 'PILOTO QUALI 01', time: '00:33.101' },
          { position: 2, kart: '202', name: 'PILOTO QUALI 02', time: '00:33.202' },
        ],
      })
      .mockResolvedValueOnce({
        status: 'finished',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:05:00.000Z',
        message: 'Tomada encerrada',
        drivers: [],
      });

    await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    vi.setSystemTime(new Date('2026-05-09T12:00:09.000Z'));
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.content).toContain('201');
    expect(data.content).toContain('202');
    expect(data.content).not.toContain('final-race-stage');
  });

  it('keeps manual final-real mode on the cached grid when the current source returns no active drivers without a finished race status', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:05.000Z'));
    vi.mocked(readTb50DisplayModeFromStore).mockResolvedValue({ mode: 'final-real', updatedAt: '2026-05-09T12:00:00.000Z', persistent: true });

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:00.000Z',
        sessionType: 'race',
        eventName: 'BATERIA 1 (Corrida) - Tracado 1',
        drivers: [
          { position: 1, kart: '201', name: 'PILOTO RACE 01', time: '00:33.101' },
          { position: 2, kart: '202', name: 'PILOTO RACE 02', time: '00:33.202' },
        ],
      })
      .mockResolvedValueOnce({
        status: 'empty',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:08.000Z',
        sessionType: 'race',
        eventName: 'BATERIA 1 (Corrida) - Tracado 1',
        message: 'Nenhuma corrida aberta',
        drivers: [],
      });

    await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    vi.setSystemTime(new Date('2026-05-09T12:00:08.000Z'));
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.finalRedirect).toBe(false);
    expect(data.content).toContain('201');
    expect(data.content).toContain('202');
    expect(data.content).not.toContain('final-race-frame-stage');
  });

  it('clears the grid when the cached timing session is stale and LiveTime returns no drivers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:00:00.000Z'));

    vi.mocked(fetchExternalSnapshot)
      .mockResolvedValueOnce({
        status: 'live',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:00.000Z',
        drivers: [
          { position: 1, kart: '201', name: 'PILOTO QUALI 01', time: '00:33.101' },
          { position: 2, kart: '202', name: 'PILOTO QUALI 02', time: '00:33.202' },
        ],
      })
      .mockResolvedValueOnce({
        status: 'empty',
        source: 'dom-scraper',
        updatedAt: '2026-05-09T12:00:11.000Z',
        message: 'Nenhuma corrida aberta',
        drivers: [],
      });

    await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    vi.setSystemTime(new Date('2026-05-09T12:00:11.000Z'));
    const response = await GET(new NextRequest('http://localhost/placar-telao-tb50?_format=json'));
    const data = await response.json();

    expect(data.content).not.toContain('201');
    expect(data.content).not.toContain('202');
    expect(data.contentUsable).toBe(false);
  });
});
