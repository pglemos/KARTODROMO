// Tipos do UDK Bridge: dados brutos do LapTime e payloads do UDK (Supabase).

export type LapTimeRacingRow = {
  Id_Racing: number;
  RacingState: number;
  Name?: string;
  Id_RacingType?: number;
  RacingTypeName?: string;
  Id_RacingGroup?: number;
  RacingGroupName?: string;
  Id_RacingEvent?: number;
  RacingEventName?: string;
  Id_RacingTrack?: number;
  RacingTrackName?: string;
  ExpectedDateTime?: Date;
  StartDateTime?: Date;
  EndTime?: Date | string;
  Id_EndType?: number;
  FinishLap?: number | null;
  FinishTime?: Date | string | null;
  Id_Booking?: number | null;
  TotalTime?: string | number | null;
};

export type LapTimeCompetitorRow = {
  Id_RacingCompetitor: number;
  Id_Racing: number;
  Id_Category?: number;
  Number?: string;
  Transponder?: number;
  Competitor?: string;
  ShortName?: string;
  Email?: string;
  Pos?: number;
  Lap?: number;
  LapTime?: Date | string;
  BestLapTime?: Date | string;
  TotalTime?: Date | string;
  DiffLeader?: Date | string;
  Diff?: Date | string;
  AvgLapTime?: Date | string;
  AvgSpeedRacing?: number;
  StartPos?: number;
  RacingStatus?: number;
  IsHidden?: boolean;
  Finish?: boolean;
  BookingCustomerUId?: string;
  PenaltyTotalTime?: Date | string | null;
  PenaltyLap?: number;
  Transponder2?: number | null;
  Name2?: string | null;
  Transponder3?: number | null;
  Name3?: string | null;
  Transponder4?: number | null;
  Name4?: string | null;
  Transponder5?: number | null;
  Name5?: string | null;
  Transponder6?: number | null;
  Name6?: string | null;
};

export type LapTimeRacingFull = {
  racing: LapTimeRacingRow;
  competitors: LapTimeCompetitorRow[];
  finishedByFlag: boolean;
};

// ---- Payloads do UDK ----

export type UdkResultDraft = {
  stage_id: string;
  session_id: string | null;
  category_id: string | null;
  title: string;
  status: 'draft';
  version: number;
  source_system: 'laptime';
  external_racing_id: number;
  external_imported_at: string;
  fastest_lap_ms?: number | null;
};

export type UdkResultEntryDraft = {
  driver_id: string;
  position: number;
  kart_number?: number | null;
  laps: number;
  total_time_ms?: number | null;
  best_lap_ms?: number | null;
  penalty_ms?: number | null;
  status: 'classified' | 'not_classified' | 'disqualified' | 'did_not_start' | 'did_not_finish';
  pole?: boolean;
  fastest_lap?: boolean;
  external_competitor_id?: number | null;
};

export type UdkImportBatchDraft = {
  stage_id: string;
  source: 'laptime';
  status: 'imported';
  confidence: number;
  diagnostics: Record<string, unknown>;
};

// ---- Configuração ----

export type UdkBridgeConfig = {
  // UUIDs do campeonato UDK (campeonato/semana em produção).
  championshipId: string;
  seasonId: string;
  // Mapeamento de categorias LapTime -> categorias UDK. Categorias do LapTime
  // são genéricas (1=Indoor, 2=Super Kart), então o mapeamento é por env.
  categoryMapping: Record<number, string>;
  // Map para sessões UDK por etapa: stage_id -> { sessionId, name, kind }.
  stages: Record<string, { sessionId: string | null; name: string; kind: string }[]>;
  // Campos de tempo (horas) usados pelo LapTime como base para tempos.
  timeBaseHours?: number;
};