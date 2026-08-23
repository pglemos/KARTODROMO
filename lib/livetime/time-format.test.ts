import { describe, expect, it } from 'vitest';
import { formatDurationMs, parseDurationMs } from '@/lib/livetime/time-format';

describe('formatacao de tempos de prova', () => {
  it('mantem minutos para voltas abaixo de uma hora', () => {
    expect(formatDurationMs(59 * 60_000 + 59_999)).toBe('59:59.999');
  });

  it('troca para horas quando a prova completa uma hora', () => {
    expect(formatDurationMs(60 * 60_000)).toBe('1:00:00.000');
  });

  it('converte 700 minutos para horas, minutos, segundos e milissegundos', () => {
    const milliseconds = 700 * 60_000 + 48_670;
    expect(formatDurationMs(milliseconds)).toBe('11:40:48.670');
    expect(parseDurationMs('700:48.670')).toBe(milliseconds);
    expect(parseDurationMs('11:40:48.670')).toBe(milliseconds);
  });
});
