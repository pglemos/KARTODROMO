import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api-client';
import type {
  Cliente,
  Pista,
  Reserva,
  ReservaPayload,
  ReservaUpdate,
  ReservaWithRelations,
} from './reservas.types';

type ReservaFullRow = Reserva & { cliente_nome: string | null; pista_nome: string | null };

const toRelations = (row: ReservaFullRow): ReservaWithRelations => ({
  ...row,
  clientes: row.cliente_nome ? { nome: row.cliente_nome } : null,
  pistas: row.pista_nome ? { nome: row.pista_nome } : null,
});

export const listReservas = async (): Promise<ReservaWithRelations[]> => {
  const rows = await apiGet<ReservaFullRow[]>('reservas_full');
  return rows.map(toRelations);
};

export const createReserva = async (payload: ReservaPayload): Promise<Reserva> =>
  apiPost<Reserva>('reservas', payload);

export const updateReserva = async (id: string, payload: ReservaUpdate): Promise<Reserva> =>
  apiPatch<Reserva>(`reservas/${id}`, payload);

export const removeReserva = async (id: string): Promise<void> => {
  await apiDelete(`reservas/${id}`);
};

export const listClientes = async (): Promise<Cliente[]> => apiGet<Cliente[]>('clientes?order=nome');

export const listPistas = async (): Promise<Pista[]> => apiGet<Pista[]>('pistas?order=nome');
