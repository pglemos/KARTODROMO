import type { KartCategory } from '@/lib/equalizacao/kart';

export type KartStatus = 'disponivel' | 'em_uso' | 'manutencao' | 'inativo' | string;

export type Kart = {
  id: string;
  numero: string;
  modelo: string;
  categoria: string;
  motor: string | null;
  status: KartStatus;
  km_total: number;
  ultima_manutencao: string | null;
  proxima_manutencao: string | null;
  notes: string | null;
  ativo: boolean;
  created_at: string;
  chassi_numero: string | null;
  sensor_numero: string | null;
  redutor_antigo: string | null;
  redutor_novo: string | null;
  ultimo_piloto_equalizacao: string | null;
  traco_equalizacao: string | null;
  media_equalizacao_ms: number | null;
  melhor_equalizacao_ms: number | null;
  desvio_equalizacao_ms: number | null;
  ultima_equalizacao: string | null;
  manutencoes_pendentes: number;
};

export type KartEqualization = {
  id: string;
  kart_id: string;
  categoria: KartCategory;
  piloto: string;
  traco: string;
  data: string;
  voltas_validas: number;
  melhor_volta_ms: number;
  media_ms: number;
  desvio_ms: number;
  alvo_ms: number;
  status: 'aprovada' | 'ajustar' | 'reteste' | 'cancelada' | string;
  observacoes: string | null;
  created_at: string;
};

export type KartMaintenance = {
  id: string;
  kart_id: string;
  tipo: string;
  descricao: string;
  custo: number;
  data: string;
  responsavel: string | null;
  status: 'pendente' | 'em_andamento' | 'concluida' | string;
  created_at: string;
};

export type KartIdentityEvent = {
  id: string;
  kart_id: string;
  data: string;
  acao: 'cadastro' | 'troca_identidade' | 'correcao' | string;
  chassi_anterior: string | null;
  chassi_novo: string | null;
  placa_anterior: string | null;
  placa_nova: string | null;
  sensor_anterior: string | null;
  sensor_novo: string | null;
  observacoes: string | null;
  responsavel: string | null;
  created_at: string;
};

export type KartHistoryItem = {
  raceId: string;
  raceName: string;
  raceType: string | null;
  raceDate: string;
  trackName: string | null;
  plate: string | null;
  sensor: string | null;
  driver: string | null;
  bestLap: string | null;
  bestLapMs: number | null;
  laps: number | null;
  averageLap: string | null;
  matchedBy: 'sensor' | 'plate';
};

export type HistoryWindow = {
  count: number;
  bestLapMs: number | null;
  averageBestLapMs: number | null;
  firstBestLapMs: number | null;
  lastBestLapMs: number | null;
  trendMs: number | null;
};

export type KartHistoryResponse = {
  rows: KartHistoryItem[];
  windows: Record<'7' | '15' | '30' | '60', HistoryWindow>;
};
