export type ReservaStatus = 'pendente' | 'confirmada' | 'cancelada' | 'concluida';

export type Reserva = {
  id: string;
  cliente_id: string | null;
  pista_id: string | null;
  data_inicio: string;
  data_fim: string | null;
  qtd_pilotos: number;
  valor: number;
  status: ReservaStatus;
  notes: string | null;
  created_at: string;
};

export type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  notes: string | null;
};

export type Pista = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
};

export type ReservaWithRelations = Reserva & {
  clientes: Pick<Cliente, 'nome'> | null;
  pistas: Pick<Pista, 'nome'> | null;
};

export type ReservaPayload = Omit<Reserva, 'id' | 'created_at'>;
export type ReservaUpdate = Partial<ReservaPayload>;
