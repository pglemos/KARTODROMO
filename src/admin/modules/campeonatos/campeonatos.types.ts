export type CampeonatoStatus = 'ativo' | 'encerrado' | 'rascunho';

export type Campeonato = {
  id: string;
  nome: string;
  slug: string | null;
  temporada: string | null;
  status: CampeonatoStatus;
};

export type CampeonatoPayload = Omit<Campeonato, 'id'>;
export type CampeonatoUpdate = Partial<CampeonatoPayload>;

export type EtapaStatus = 'agendada' | 'realizada' | 'cancelada';

export type Etapa = {
  id: string;
  campeonato_id: string | null;
  nome: string;
  data: string | null;
  round: number | null;
  status: EtapaStatus;
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
