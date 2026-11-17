/** Substituto do módulo `cloudflare:workers` para os Workers empacotados para a VPS. */
export { DurableObject } from './durable';

export class WorkerEntrypoint {
  constructor(readonly ctx: unknown, readonly env: Record<string, unknown>) {}
}
export const env: Record<string, unknown> = {};
