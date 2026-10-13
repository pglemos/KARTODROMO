import type { FinishLine } from './lap-detector';

export interface TrackConfig {
  name: string;
  finishLine: FinishLine;
  maxAccuracyMeters: number;
}

// Só preencher com coordenadas medidas e aprovadas pelo kartódromo.
export const trackConfig: TrackConfig | null = null;
