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
};

export type EtapaOption = {
  id: string;
  campeonato_id: string | null;
  nome: string;
};

export type PilotoOption = {
  id: string;
  nome: string;
  numero: string | null;
  equipe: string | null;
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
};

export type LiveSnapshot = {
  status: 'online' | 'offline' | 'pausado';
  pilotos: LivePiloto[];
  erro?: string;
  atualizadoEm?: string;
};

export const msParaTexto = (milliseconds?: number | null): string => {
  if (milliseconds === null || milliseconds === undefined || milliseconds < 0) {
    return '—';
  }

  const total = Math.round(milliseconds);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const millis = total % 1_000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};
