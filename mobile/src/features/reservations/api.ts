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
  agenda() {
    return mobileRequest<AgendaResponse>('/api/mobile/v1/agenda');
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
