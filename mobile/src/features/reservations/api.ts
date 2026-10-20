import { MobileApiError, mobileRequest } from '../../api/client';
import type {
  AgendaResponse,
  CouponPreviewResponse,
  CreateReservationInput,
  CreateReservationResponse,
  ReservationOrder,
} from './schemas';

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const reservationsApi = {
  async agenda() {
    let data: AgendaResponse;
    try {
      data = await mobileRequest<AgendaResponse>('/api/mobile/v1/agenda');
    } catch (error) {
      if (!(error instanceof MobileApiError) || error.status !== 404) throw error;
      // A agenda pública existe antes da implantação das contas e reservas mobile.
      data = { ...await mobileRequest<AgendaResponse>('/api/agenda'), bookingChannel: 'site' };
    }
    if (!data || !Number.isSafeInteger(data.precoCentavos) || data.precoCentavos < 0 ||
        !Number.isSafeInteger(data.maxPilotos) || data.maxPilotos < 1 ||
        typeof data.pagamentoOnline !== 'boolean' || !Array.isArray(data.horarios) ||
        data.horarios.some((slot) => !slot || !Number.isSafeInteger(slot.id) || slot.id < 1 ||
          typeof slot.nome !== 'string' || !slot.nome.trim() ||
          !Number.isSafeInteger(slot.livres) || slot.livres < 0 ||
          typeof slot.inicio !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(slot.inicio) ||
          !Number.isFinite(Date.parse(slot.inicio)) ||
          new Date(`${slot.inicio.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== slot.inicio.slice(0, 10)) ||
        new Set(data.horarios.map((slot) => slot.id)).size !== data.horarios.length) {
      throw new MobileApiError('A agenda recebida é inválida. Tente novamente.');
    }
    return data;
  },
  list(accessToken: string) {
    return mobileRequest<ReservationOrder[]>('/api/mobile/v1/reservations', { accessToken });
  },
  get(id: string, accessToken: string) {
    return mobileRequest<ReservationOrder>(`/api/mobile/v1/reservations/${encodeURIComponent(id)}`, { accessToken });
  },
  create(input: CreateReservationInput, accessToken: string, idempotencyKey: string) {
    return mobileRequest<CreateReservationResponse>('/api/mobile/v1/reservations', {
      method: 'POST',
      body: input,
      accessToken,
      idempotencyKey,
    });
  },
  async previewCoupon(input: { codigo: string; bateriaId: number; quantidade: number }, accessToken: string) {
    const job = await mobileRequest<{ requestId: string }>('/api/mobile/v1/coupons/preview', {
      method: 'POST',
      body: input,
      accessToken,
    });
    if (!job.requestId) throw new MobileApiError('Não foi possível validar o cupom. Tente novamente.');

    for (let attempt = 0; attempt < 12; attempt++) {
      const result = await mobileRequest<CouponPreviewResponse>(
        `/api/mobile/v1/coupons/preview/${encodeURIComponent(job.requestId)}`,
        { accessToken },
      );
      if (result.status === 'completed') return result;
      if (attempt < 11) await pause(1000);
    }
    throw new MobileApiError('A validação do cupom está demorando. Tente novamente.');
  },
};
