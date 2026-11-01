import { describe, expect, it, vi } from 'vitest';
import { writeTimingEvent, MAX_PENDING_TIMING_BYTES } from '../lib/timing/sse';

describe('limite de memoria dos clientes de cronometragem', () => {
  it('envia normalmente para um painel que acompanha a corrida', () => {
    const res = { destroyed: false, writableEnded: false, writableLength: 0, write: vi.fn(() => true), destroy: vi.fn() };
    expect(writeTimingEvent(res, 'event: state\ndata: {}\n\n')).toBe(true);
    expect(res.write).toHaveBeenCalledOnce();
  });
  it('desconecta um cliente travado antes de acumular memoria sem limite', () => {
    const res = { destroyed: false, writableEnded: false, writableLength: MAX_PENDING_TIMING_BYTES, write: vi.fn(), destroy: vi.fn() };
    expect(writeTimingEvent(res, 'mais dados')).toBe(false);
    expect(res.write).not.toHaveBeenCalled();
    expect(res.destroy).toHaveBeenCalledOnce();
  });
  it('nao escreve em conexao encerrada', () => {
    const res = { destroyed: true, writableEnded: false, writableLength: 0, write: vi.fn(), destroy: vi.fn() };
    expect(writeTimingEvent(res, 'dados')).toBe(false);
    expect(res.write).not.toHaveBeenCalled();
  });
});
