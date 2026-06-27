import type { Page } from '../../lib/api-client';

export type LapTimeBooking = {
  id: string;
  nome: string;
  dataHora: string;
  vagasTotal: number;
  vagasLivres: number;
  reservados: number;
  pagos: number;
  aprovados: number;
  pendentes: number;
  online: boolean;
  encerrada: boolean;
};

export type LapTimeBookingCustomer = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail: string | null;
  dataReserva: string | null;
  preco: number;
  pago: number;
  pagou: boolean;
  aprovado: boolean;
  cancelado: boolean;
};

export type LapTimeBookingsFilters = {
  q?: string;
  status?: 'aberta' | 'encerrada' | '';
  from?: string;
  to?: string;
};

async function fetchLapTimeJson<T>(path: string): Promise<{ data: T; total: number }> {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error((data && data.error) || `HTTP ${response.status}`);
  }

  const totalHeader = response.headers.get('x-total-count');
  const total = totalHeader ? Number(totalHeader) : Array.isArray(data) ? data.length : 0;
  return { data: data as T, total };
}

export const listLapTimeBookingsPage = async (
  filters: LapTimeBookingsFilters,
  page: number,
  pageSize: number,
): Promise<Page<LapTimeBooking>> => {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const { data, total } = await fetchLapTimeJson<LapTimeBooking[]>(
    `/api/admin/laptime/bookings?${params.toString()}`,
  );
  return { data, total };
};

export const listLapTimeBookingCustomers = async (bookingId: string): Promise<LapTimeBookingCustomer[]> => {
  const { data } = await fetchLapTimeJson<LapTimeBookingCustomer[]>(
    `/api/admin/laptime/booking-customers?bookingId=${encodeURIComponent(bookingId)}`,
  );
  return data;
};
