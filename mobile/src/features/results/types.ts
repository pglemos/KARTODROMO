export interface ResultLine {
  displayName: string;
  position: number;
  kart: string;
  laps: number;
  bestLapMs: number | null;
}

export interface PublicSessionResults {
  sessionId: string;
  eventName: string;
  eventDate: string;
  results: ResultLine[];
}

export interface PersonalResult extends ResultLine {
  sessionId: string;
  eventName: string;
  eventDate: string;
}

export type PersonalResultsResponse =
  | { vinculo: 'pendente'; mensagem: string; results: [] }
  | { vinculo: 'validado'; results: PersonalResult[] };
