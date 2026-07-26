import type { Campeonato, Etapa, Piloto } from '../campeonatos/campeonatos.types';

export type CorridaStatus = 'rascunho' | 'publicada';

export type Corrida = {
  id: string;
  etapa_id: string | null;
  campeonato_id: string | null;
  titulo: string;
  data: string | null;
  status: CorridaStatus;
  source: string | null;
};

export type CorridaWithRelations = Corrida & {
  campeonatos: Pick<Campeonato, 'nome'> | null;
  etapas: Pick<Etapa, 'nome'> | null;
};

export type CorridaPayload = Omit<Corrida, 'id'>;
export type CorridaUpdate = Partial<CorridaPayload>;

export type Resultado = {
  id: string;
  corrida_id: string | null;
  piloto_id: string | null;
  piloto_nome: string;
  posicao: number | null;
  melhor_volta: string | null;
  voltas: number | null;
  pontos: number | null;
  gap: string | null;
};

export type ResultadoWithPiloto = Resultado & {
  pilotos: Pick<Piloto, 'numero' | 'equipe'> | null;
};

export type ResultadoPayload = Omit<Resultado, 'id'>;
export type ResultadoUpdate = Partial<ResultadoPayload>;
