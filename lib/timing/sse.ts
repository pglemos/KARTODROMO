import type { ServerResponse } from 'node:http';

export const MAX_PENDING_TIMING_BYTES = 1024 * 1024;
type EventResponse = Pick<ServerResponse, 'destroyed' | 'writableEnded' | 'writableLength' | 'write' | 'destroy'>;

/** Um painel sem leitura nao pode reter todos os retratos da corrida na memoria do servidor. */
export function writeTimingEvent(res: EventResponse, payload: string): boolean {
  if (res.destroyed || res.writableEnded) return false;
  if (res.writableLength + Buffer.byteLength(payload) > MAX_PENDING_TIMING_BYTES) {
    res.destroy(); // EventSource reconecta e recebe o retrato atual, sem fila de retratos antigos.
    return false;
  }
  res.write(payload);
  return true;
}
