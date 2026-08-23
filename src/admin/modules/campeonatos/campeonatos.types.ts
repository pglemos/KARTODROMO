import type { ClassificacaoFonte } from '@/lib/race-formats';

export type CampeonatoStatus = 'ativo' | 'encerrado' | 'rascunho';

export type Campeonato = {
  id: string;
  nome: string;
  slug: string | null;
  temporada: string | null;
  status: CampeonatoStatus;
  formato_id: string | null;
  /** Tabela de pontos customizada (objeto quando vem do D1, string JSON quando vem do bridge local). */
  pontos_json: unknown;
  desempate_json: unknown;
  bonus_pole: number | null;
  bonus_melhor_volta: number | null;
  descartes: number | null;
};

export type CampeonatoPayload = Omit<Campeonato, 'id'>;
export type CampeonatoUpdate = Partial<CampeonatoPayload>;

export type FormatoCorridaRecord = {
  id: string;
  nome: string;
  descricao: string | null;
  tt_habilitada: boolean;
  tt_duracao_min: number | null;
  tt_define_grid: boolean;
  tt_pontua: boolean;
  corrida_duracao_min: number | null;
  paradas_habilitadas: boolean;
  paradas_quantidade: number;
  parada_tempo_minimo_ms: number | null;
  boxes_abrem_apos_ms: number | null;
  boxes_fecham_apos_ms: number | null;
  paradas_adicionais_permitidas: number;
  punicoes_fonte: 'cronometragem';
  classificacao_fonte: ClassificacaoFonte;
  desempate: unknown;
  is_default: boolean;
};

export const FORMATO_CLASSIFICACAO_LABELS: Record<ClassificacaoFonte, string> = {
  corrida: 'Posição na corrida',
  melhor_tempo: 'Melhor tempo',
  combinada: 'TT + Corrida (combinada)',
};

export type EtapaStatus = 'agendada' | 'realizada' | 'cancelada';

export type Etapa = {
  id: string;
  campeonato_id: string | null;
  nome: string;
  data: string | null;
  round: number | null;
  status: EtapaStatus;
  formato_id: string | null;
};

export type EtapaWithCampeonato = Etapa & {
  campeonatos: Pick<Campeonato, 'nome'> | null;
};

export type EtapaPayload = Omit<Etapa, 'id'>;
export type EtapaUpdate = Partial<EtapaPayload>;

export type Piloto = {
  id: string;
  nome: string;
  numero: string | null;
  equipe: string | null;
  cliente_id: string | null;
};

export type PilotoPayload = Omit<Piloto, 'id'>;
export type PilotoUpdate = Partial<PilotoPayload>;

export type Classificacao = {
  id: string;
  campeonato_id: string | null;
  piloto_id: string | null;
  pontos: number;
  posicao: number | null;
};

export type ClassificacaoWithPiloto = Classificacao & {
  pilotos: Pick<Piloto, 'nome' | 'numero' | 'equipe'> | null;
};

export type CampeonatoInscricaoStatus = 'pendente' | 'em_analise' | 'confirmada' | 'recusada' | 'cancelada';
export type CampeonatoInscricaoModalidade = 'equipe' | 'individual';

export type CampeonatoInscricao = {
  id: string;
  protocol: string;
  campeonato_id: string | null;
  evento: string;
  modalidade: CampeonatoInscricaoModalidade;
  status: CampeonatoInscricaoStatus;
  nome_equipe: string | null;
  nome_chefe: string | null;
  nome_completo: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  idade: number | null;
  peso_kg: number | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  experiencia: string | null;
  nivel_atual: string | null;
  disponibilidade: string | null;
  participacao_desejada: string | null;
  interesse_ranking: string | null;
  janelas_preferidas: string | null;
  equipamento: string | null;
  equipamento_detalhes: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  restricoes_medicas: string | null;
  alergias: string | null;
  medicamentos: string | null;
  objetivos: string | null;
  observacoes: string | null;
  quantidade_karts: number | null;
  pilotos: Array<{ nome: string; peso_kg: number | null }>;
  pagamento: string | null;
  aceites: Record<string, boolean>;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampeonatoInscricaoUpdate = Partial<Pick<CampeonatoInscricao, 'status' | 'admin_notes'>>;
