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
  /** Os outros pilotos, um por vaga, com os mesmos campos obrigatórios do totem (CEP e complemento opcionais). */
  acompanhantes: Acompanhante[];
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

export interface Acompanhante {
  nome: string;
  documento: string;
  /** AAAA-MM-DD */
  nascimento: string;
  instagram: string;
  email: string;
  telefone: string;
  peso: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep?: string;
  complemento?: string;
}

export type ContatoAcompanhante = Pick<Acompanhante, 'email' | 'telefone' | 'peso' | 'endereco' | 'bairro' | 'cidade'> & { cep: string; complemento: string };

/** Mesmas regras de `validarReserva` no worker (workers/pre-cadastro/src/validar.ts). Devolve o erro ou os campos normalizados. */
export function validarContatoAcompanhante(
  a: ContatoAcompanhante,
  quem: string,
): { erro: string } | { dados: Omit<Acompanhante, 'nome' | 'documento' | 'nascimento' | 'instagram'> } {
  const txt = (v: string, max: number) => v.replace(/\s+/g, ' ').trim().slice(0, max);
  const email = txt(a.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { erro: `Informe um e-mail válido ${quem}.` };
  const telefone = a.telefone.replace(/\D/g, '');
  if (telefone.length < 10 || telefone.length > 13) return { erro: `Informe o celular com DDD ${quem}.` };
  const peso = txt(a.peso, 6).replace(',', '.');
  if (!(Number(peso) >= 20 && Number(peso) <= 250)) return { erro: `Informe o peso ${quem} (entre 20 e 250 kg).` };
  const endereco = txt(a.endereco, 150);
  if (!endereco) return { erro: `Informe o endereço (rua e número) ${quem}.` };
  const bairro = txt(a.bairro, 80);
  if (!bairro) return { erro: `Informe o bairro ${quem}.` };
  const cidade = txt(a.cidade, 80);
  if (!cidade) return { erro: `Informe a cidade ${quem}.` };
  const cep = a.cep.replace(/\D/g, '').slice(0, 8);
  const complemento = txt(a.complemento, 80);
  return { dados: { email, telefone, peso, endereco, bairro, cidade, ...(cep ? { cep } : {}), ...(complemento ? { complemento } : {}) } };
}
