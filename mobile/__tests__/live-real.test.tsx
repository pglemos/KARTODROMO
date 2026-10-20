import { render, waitFor } from '@testing-library/react-native';

import { formatElapsed, lapMs, snapshotToSession, type LiveSnapshot } from '../src/features/live/api';
import { LiveTimeScreen } from '../src/components/livetime-screen';

// Ao vivo da loja: retrato da cronometragem → tela (sem telemetria inventada).
const snap: LiveSnapshot = {
  status: 'live',
  eventName: 'BATERIA 17:00 · CORRIDA',
  trackName: 'Kartodromo Internacional de Betim',
  sessionType: 'race',
  startedAt: '2026-10-20T20:00:00.000Z',
  updatedAt: '2026-10-20T20:05:00.000Z',
  drivers: [
    { position: 1, kart: '48', name: 'Jorge Antonio', best: '1:15.418', laps: 4, last: '1:17.683', bestLap: 3, gap: '' },
    { position: 2, kart: '44', name: 'Iury Pedroso', best: '1:14.900', laps: 4, last: '1:16.900', bestLap: 2, gap: '+2.350' },
    { position: 3, kart: '81', name: 'Thallison Danilo', best: '1:17.452', laps: 3, last: '1:18.000', bestLap: 1, gap: '+1 volta' },
  ],
};

describe('ao vivo com dado real', () => {
  it('converte tempos e o relógio da bateria', () => {
    expect(lapMs('1:15.418')).toBe(75_418);
    expect(lapMs('58.12')).toBe(58_120);
    expect(lapMs('—')).toBeNull();
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });

  it('monta a tela com a volta mais rápida e as diferenças', () => {
    const s = snapshotToSession(snap, Date.parse('2026-10-20T20:05:30.000Z'))!;
    expect(s.title).toBe('BATERIA 17:00');
    expect(s.subtitle).toBe('CORRIDA · AO VIVO');
    expect(s.status).toBe('GREEN');
    expect(s.elapsedTime).toBe('5:30');
    expect(s.fastestLap).toMatchObject({ competitorNumber: '44', time: '1:14.900', lapNumber: 2 });
    expect(s.competitors.map((c) => c.isFastestLap)).toEqual([false, true, false]);
    expect(s.competitors[1]).toMatchObject({ diffLeader: '+2.350', diffPrev: '+2.350', currentLap: 4 });
    expect(s.competitors[2]).toMatchObject({ diffLeader: '+1 volta', diffPrev: '+1 volta' });
  });

  it('bateria encerrada mostra bandeira quadriculada; sem bateria não monta tela', () => {
    expect(snapshotToSession({ ...snap, status: 'finished' })).toMatchObject({ status: 'CHECKERED', elapsedTime: 'Encerrada' });
    expect(snapshotToSession({ ...snap, status: 'empty', drivers: [] })).toBeNull();
  });

  it('a tela real não oferece o modo cockpit de demonstração', async () => {
    const view = await render(<LiveTimeScreen session={snapshotToSession({ ...snap, status: 'finished' })!} hudEnabled={false} />);
    await waitFor(() => expect(view.getByText('BATERIA 17:00')).toBeTruthy());
    expect(view.queryByTestId('btn-open-cockpit-hud')).toBeNull();
    expect(view.getByTestId('flag-status-label').props.children).toBe('BANDEIRA QUADRICULADA');
    expect(view.getByText(/48 Jorge Antonio/)).toBeTruthy();
  });
});
