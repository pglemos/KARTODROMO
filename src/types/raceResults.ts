export interface RaceResultEntry {
  position: number;
  name: string;
  kart?: string;
  laps?: number;
  bestLap?: string;
  bestLapMs?: number;
  totalTime?: string;
  points?: number;
  status?: string;
}

export interface ChampionshipStanding {
  position: number;
  name: string;
  points: number;
  starts: number;
  wins: number;
  seconds: number;
  thirds: number;
  fourths: number;
  countedResults: number[];
  discardedResults: number[];
}

export interface RaceResultPayload {
  championshipId: string;
  championshipName: string;
  season: string;
  title: string;
  date: string;
  round?: number;
  status: 'live' | 'final' | 'provisional';
  source?: string;
  generatedAt: string;
  entries: RaceResultEntry[];
  standings?: ChampionshipStanding[];
}
