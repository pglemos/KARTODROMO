export interface AgendaSlot {
  id: number;
  inicio: string;
  nome: string;
  livres: number;
}

export interface AgendaResponse {
  bookingChannel?: 'site';
  atualizadoEm: string;
  precoCentavos: number;
  maxPilotos: number;
  prazoMin: number;
  antecedenciaMin: number;
  pagamentoOnline: boolean;
  horarios: AgendaSlot[];
}

export type ReservationStatus =
  | 'novo'
  | 'aguardando_pagamento'
  | 'pago'
  | 'confirmado'
  | 'recusado'
  | 'expirado'
  | 'pago_sem_vaga'
  | 'erro_pagamento';

export interface ReservationOrder {
  id: string;
  codigo: string;
  status: ReservationStatus;
  forma: 'pix' | 'cartao';
  quantidade: number;
  nome: string;
  descricao: string | null;
  inicio: string | null;
  valorCentavos: number | null;
  expiraEm: string | null;
  pix: { payload: string; imagem?: string | null } | null;
  invoiceUrl: string | null;
  preparandoPagamento: boolean;
  erro: string | null;
  criadoEm: string;
}

export interface CreateReservationInput {
  bateriaId: number;
  quantidade: number;
  pilotos: string[];
  forma: 'pix' | 'cartao';
  nascimento: string;
  politica: true;
  /** @usuário de quem reserva (sai no resultado da bateria). */
  instagram: string;
  /** false = quem reserva não vai pilotar. Cada vaga é de uma pessoa diferente. */
  compradorPilota: boolean;
  /** Os outros pilotos, um por vaga: nome completo, CPF e nascimento (AAAA-MM-DD); Instagram opcional. */
  acompanhantes: { nome: string; documento: string; nascimento: string; instagram?: string }[];
  cupom?: string;
}

export type CouponPreviewResponse =
  | { status: 'pending' }
  | {
      status: 'completed';
      brutoCentavos: number;
      descontoCentavos: number;
      totalCentavos: number;
    }
  | { status: 'completed'; erro: string };

export interface CreateReservationResponse {
  id: string;
  codigo: string;
}
