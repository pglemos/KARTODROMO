import { render, waitFor } from '@testing-library/react-native';

import { formatElapsed, lapMs, preserveSnapshotTimestamp, retainExpandedCompetitorPosition, retainLiveCompetitors, snapshotToSession, type LiveSnapshot } from '../src/features/live/api';
import { LiveTimeScreen } from '../src/components/livetime-screen';
import { AoVivoReal } from '../src/components/ao-vivo-real';
import { idadeSnapshot } from '../src/components/ao-vivo-real';

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
  it('preserva a lista de pilotos quando o retrato só atualiza metadados', () => {
    const anterior = snapshotToSession(snap, Date.parse('2026-10-20T20:05:00.000Z'))!.competitors;
    const repetido = snapshotToSession({ ...snap, updatedAt: '2026-10-20T20:05:02.000Z' }, Date.parse('2026-10-20T20:05:02.000Z'))!.competitors;

    expect(retainLiveCompetitors(anterior, repetido)).toBe(anterior);
  });

  it('mantém a idade do snapshot encerrado quando só avança o horário da consulta', () => {
    expect(preserveSnapshotTimestamp).toEqual(expect.any(Function));

    const anterior = { ...snap, status: 'finished' as const, updatedAt: '2026-10-20T20:05:00.000Z' };
    const consultaIgual = { ...anterior, updatedAt: '2026-10-20T20:06:30.000Z' };
    const preservado = preserveSnapshotTimestamp(anterior, consultaIgual, true);
    const sessao = snapshotToSession(preservado, Date.parse('2026-10-20T20:06:01.000Z'))!;

    expect(preservado.lastUpdatedAt).toBe('2026-10-20T20:05:00.000Z');
    expect(sessao.stale).toBe(true);
  });

  it('reinicia a idade do snapshot quando chega uma nova volta', () => {
    expect(preserveSnapshotTimestamp).toEqual(expect.any(Function));

    const anterior = { ...snap, status: 'finished' as const, updatedAt: '2026-10-20T20:05:00.000Z' };
    const novaVolta = {
      ...anterior,
      updatedAt: '2026-10-20T20:06:30.000Z',
      drivers: anterior.drivers.map((driver, index) => index === 0 ? { ...driver, laps: 5, last: '1:16.800' } : driver),
    };
    const preservado = preserveSnapshotTimestamp(anterior, novaVolta, false);
    const sessao = snapshotToSession(preservado, Date.parse('2026-10-20T20:06:31.000Z'))!;

    expect(preservado.lastUpdatedAt).toBe('2026-10-20T20:06:30.000Z');
    expect(sessao.stale).toBe(false);
  });

  it('substitui a lista quando uma volta do piloto muda', () => {
    const anterior = snapshotToSession(snap, Date.parse('2026-10-20T20:05:00.000Z'))!.competitors;
    const comNovaVolta = snapshotToSession({
      ...snap,
      drivers: snap.drivers.map((driver, index) => index === 0 ? { ...driver, laps: 5, last: '1:16.800' } : driver),
    }, Date.parse('2026-10-20T20:05:02.000Z'))!.competitors;

    expect(retainLiveCompetitors(anterior, comNovaVolta)).not.toBe(anterior);
    expect(retainLiveCompetitors(anterior, comNovaVolta)[0]).toMatchObject({ currentLap: 5, lastLapTime: '1:16.800' });
  });

  it('mantém o piloto expandido na mesma posição quando a classificação reordena', () => {
    const atual = snapshotToSession(snap)!.competitors;
    const reordenada = snapshotToSession({
      ...snap,
      drivers: [snap.drivers[1], { ...snap.drivers[0], position: 2 }, snap.drivers[2]],
    })!.competitors;

    expect(retainExpandedCompetitorPosition(reordenada, '44', 1).map((pilot) => pilot.kartNumber)).toEqual(
      atual.map((pilot) => pilot.kartNumber),
    );
  });

  it('converte tempos e o relógio da bateria', () => {
    expect(lapMs('1:15.418')).toBe(75_418);
    expect(lapMs('58.12')).toBe(58_120);
    expect(lapMs('—')).toBeNull();
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });

  it('formata a idade do retrato e identifica quando ela não pode ser calculada', () => {
    expect(idadeSnapshot(15_999)).toBe('há 15 s');
    expect(idadeSnapshot(60_000)).toBe('há 1 min');
    expect(idadeSnapshot(null)).toBe('idade desconhecida');
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
    expect(view.getByText("Jorge Antonio")).toBeTruthy();
    expect(view.getByText("KART 48")).toBeTruthy();
  });

  it('mantém só classificação e pilotos, com tentativa manual apenas quando há erro', async () => {
    const session = snapshotToSession({ ...snap, status: 'finished' }, Date.parse(snap.updatedAt))!;
    const view = await render(<AoVivoReal session={session} onRefresh={jest.fn()} refreshError="Falha de conexão" />);

    expect(view.getByLabelText('classificação')).toBeTruthy();
    expect(view.getByLabelText('pilotos')).toBeTruthy();
    expect(view.queryByLabelText('Atualizar dados da bateria')).toBeNull();
    expect(view.getByLabelText('Tentar novamente')).toBeTruthy();
  });
});
