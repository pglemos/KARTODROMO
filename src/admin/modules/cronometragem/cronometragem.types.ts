import { formatDurationMs } from '@/lib/livetime/time-format';

export type SessaoTipo = 'treino' | 'classificacao' | 'corrida';
export type SessaoStatus = 'aberta' | 'encerrada';

export type Sessao = {
  id: string;
  campeonato_id: string | null;
  etapa_id: string | null;
  nome: string;
  tipo: SessaoTipo;
  data: string;
  status: SessaoStatus;
  fonte: string | null;
  formato_id: string | null;
  created_at: string;
};

export type SessaoWithCampeonato = Sessao & {
  campeonatos: { nome: string } | null;
};

export type SessaoPayload = Omit<Sessao, 'id' | 'created_at'>;
export type SessaoUpdate = Partial<SessaoPayload>;

export type Volta = {
  id: string;
  sessao_id: string;
  piloto_id: string | null;
  piloto_nome: string;
  kart: string | null;
  numero: number;
  tempo_ms: number;
  setor1_ms: number | null;
  setor2_ms: number | null;
  setor3_ms: number | null;
  posicao: number | null;
  melhor: boolean;
  valida: boolean;
  created_at: string;
};

export type VoltaPayload = Omit<Volta, 'id' | 'created_at'>;
export type VoltaUpdate = Partial<Omit<VoltaPayload, 'sessao_id'>>;

export type CampeonatoOption = {
  id: string;
  nome: string;
  status: string;
  formato_id?: string | null;
};

export type EtapaOption = {
  id: string;
  campeonato_id: string | null;
  nome: string;
  formato_id?: string | null;
};

export type PilotoOption = {
  id: string;
  nome: string;
  numero: string | null;
  equipe: string | null;
};

export type LivePitStopStatus = 'mandatory' | 'additional' | 'short' | 'invalid' | 'outside-window';

export type LivePitStop = {
  id: string;
  volta: number | null;
  tempoParada: string | null;
  tempoCorrida: string | null;
  posicao: number | null;
  status: LivePitStopStatus;
  numeroObrigatoria?: number;
};

export type LivePitSummary = {
  necessarias: number;
  minimoMs: number;
  voltaAtual: number | null;
  tempoTotal: string | null;
  tempoTotalMs: number | null;
  validas: number;
  faltam: number;
  curtas: number;
  total: number;
  adicionais: number;
  excedentes: number;
  penalidadeVoltas: number;
  foraJanela: number;
  paradas: LivePitStop[];
};

export type LiveRaceInfo = {
  id: string;
  nome: string;
  tipo: string | null;
  inicio: string | null;
  regras: {
    paradasObrigatorias: number;
    minimoParadaMs: number;
    paradasAdicionaisPermitidas: number;
    minimoRegistroMs: number;
    voltasPenalidadePorParada: number;
    boxesAbremAposMs: number;
    boxesFechamAposMs: number;
  };
};

export type LivePiloto = {
  posicao: number;
  nome: string;
  kart: string | null;
  melhorVoltaMs?: number;
  melhorVoltaTexto?: string;
  ultimaVolta?: string;
  voltas?: number;
  gap?: string;
  paradas?: LivePitSummary;
};

export type LiveSnapshot = {
  status: 'online' | 'offline' | 'pausado';
  pilotos: LivePiloto[];
  corrida?: LiveRaceInfo;
  erro?: string;
  atualizadoEm?: string;
};

export const msParaTexto = (milliseconds?: number | null): string => {
  if (milliseconds === null || milliseconds === undefined || milliseconds < 0) {
    return '—';
  }

  return formatDurationMs(milliseconds) ?? '—';
};
