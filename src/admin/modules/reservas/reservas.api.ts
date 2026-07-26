import { apiDelete, apiGet, apiGetPage, apiPatch, apiPost, type Page } from '../../lib/api-client';
import type {
  Cliente,
  Pista,
  Reserva,
  ReservaPayload,
  ReservaStatus,
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

export type ReservasFilters = {
  status?: ReservaStatus | '';
  pista_id?: string;
  q?: string;
  from?: string;
  to?: string;
  dir?: 'asc' | 'desc';
};

export const listReservasPage = async (
  filters: ReservasFilters,
  page: number,
  pageSize: number,
): Promise<Page<ReservaWithRelations>> => {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.pista_id) params.set('pista_id', filters.pista_id);
  if (filters.q) params.set('q', filters.q);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.dir) params.set('dir', filters.dir);
  params.set('limit', String(pageSize));
  params.set('offset', String(page * pageSize));

  const { data, total } = await apiGetPage<ReservaFullRow>(`reservas_full?${params.toString()}`);
  return { data: data.map(toRelations), total };
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
