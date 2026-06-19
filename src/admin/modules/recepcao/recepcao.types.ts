export type AtendimentoStatus =
  | 'aguardando'
  | 'em_atendimento'
  | 'finalizado'
  | 'cancelado';

export type Atendimento = {
  id: string;
  cliente_id: string | null;
  nome: string;
  tipo: string | null;
  reserva_id: string | null;
  status: AtendimentoStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClienteOption = {
  id: string;
  nome: string;
};

export type ReservaStatus = 'pendente' | 'confirmada' | 'cancelada' | 'concluida';

export type ReservaOption = {
  id: string;
  cliente_id: string | null;
  data_inicio: string;
  status: ReservaStatus;
};

export type AtendimentoWithRelations = Atendimento & {
  clientes: Pick<ClienteOption, 'nome'> | null;
  reservas: Pick<ReservaOption, 'data_inicio' | 'status'> | null;
};

export type AtendimentoPayload = Omit<
  Atendimento,
  'id' | 'created_at' | 'updated_at'
>;

export type AtendimentoUpdate = Partial<AtendimentoPayload>;
