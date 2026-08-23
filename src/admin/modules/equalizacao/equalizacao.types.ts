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
  laptime_quantity: number | null;
  laptime_time_of_use_ms: number | null;
  laptime_status_control: number | null;
  laptime_updated_at: string | null;
  sensor_numero_fonte: string | null;
  sensor_fonte_atualizado_em: string | null;
  data_source: string | null;
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
  sessao_id?: string | null;
  captura_id?: string | null;
  racing_id?: string | null;
  racing_competitor_id?: string | null;
  fonte?: 'cronometragem' | 'manual_legacy' | string | null;
  tempo_antes_ms?: number | null;
  tempo_depois_ms?: number | null;
  media_antes_ms?: number | null;
  media_depois_ms?: number | null;
  voltas_antes?: number | null;
  voltas_depois?: number | null;
  volta_antes?: number | null;
  volta_depois?: number | null;
  capturado_em?: string | null;
  responsavel?: string | null;
};

export type KartEqualizationSession = {
  id: string;
  racing_id: string;
  racing_name: string;
  racing_type: string | null;
  track_name: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'aberta' | 'encerrada' | 'cancelada' | string;
  fonte: string;
  responsavel: string | null;
  created_at: string;
};

export type KartEqualizationCapture = {
  id: string;
  sessao_id: string;
  kart_id: string;
  racing_id: string;
  racing_competitor_id_antes: string;
  racing_competitor_id_depois: string | null;
  numero_kart: string;
  piloto_antes: string;
  piloto_depois: string | null;
  transponder_antes: string | null;
  transponder_depois: string | null;
  tempo_antes_ms: number;
  media_antes_ms: number | null;
  desvio_antes_ms: number | null;
  voltas_antes: number;
  volta_antes: number | null;
  capturado_antes_em: string;
  tempo_depois_ms: number | null;
  media_depois_ms: number | null;
  desvio_depois_ms: number | null;
  voltas_depois: number | null;
  volta_depois: number | null;
  capturado_depois_em: string | null;
  status: 'antes' | 'completa' | string;
  fonte: string;
  responsavel: string | null;
  created_at: string;
  updated_at: string;
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
