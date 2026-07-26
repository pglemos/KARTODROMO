import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api-client';
import type {
  Atendimento,
  AtendimentoPayload,
  AtendimentoStatus,
  AtendimentoUpdate,
  AtendimentoWithRelations,
  ClienteOption,
  ReservaOption,
} from './recepcao.types';

type AtendimentoFullRow = Atendimento & {
  cliente_nome: string | null;
  reserva_data_inicio: string | null;
  reserva_status: string | null;
};

const toRelations = (row: AtendimentoFullRow): AtendimentoWithRelations => ({
  ...row,
  clientes: row.cliente_nome ? { nome: row.cliente_nome } : null,
  reservas:
    row.reserva_data_inicio || row.reserva_status
      ? { data_inicio: row.reserva_data_inicio as string, status: row.reserva_status as ReservaOption['status'] }
      : null,
});

export const listAtendimentos = async (dateFrom?: string, dateTo?: string): Promise<AtendimentoWithRelations[]> => {
  const params = new URLSearchParams();
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  const qs = params.toString();
  const rows = await apiGet<AtendimentoFullRow[]>(`recepcao_full${qs ? `?${qs}` : ''}`);
  return rows.map(toRelations);
};

export const getAtendimentoById = async (id: string): Promise<AtendimentoWithRelations> => {
  const rows = await apiGet<AtendimentoFullRow[]>('recepcao_full');
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('Não foi possível carregar o atendimento: registro não encontrado.');
  return toRelations(row);
};

export const createAtendimento = async (payload: AtendimentoPayload): Promise<Atendimento> =>
  apiPost<Atendimento>('recepcao_atendimentos', payload);

export const updateAtendimento = async (id: string, payload: AtendimentoUpdate): Promise<Atendimento> =>
  apiPatch<Atendimento>(`recepcao_atendimentos/${id}`, { ...payload, updated_at: new Date().toISOString() });

export const removeAtendimento = async (id: string): Promise<void> => {
  await apiDelete(`recepcao_atendimentos/${id}`);
};

export const updateStatus = async (id: string, status: AtendimentoStatus): Promise<Atendimento> =>
  updateAtendimento(id, { status });

export const listClientes = async (): Promise<ClienteOption[]> => apiGet<ClienteOption[]>('clientes?order=nome');

export const listReservas = async (): Promise<ReservaOption[]> =>
  apiGet<ReservaOption[]>('reservas?order=data_inicio&dir=desc');
