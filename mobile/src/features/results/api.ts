import { MobileApiError, mobileRequest } from '../../api/client';
import type { PersonalResultsResponse, PublicSessionResults } from './types';

async function readWithRetry<T>(read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof MobileApiError) || !error.retryable || error.status === 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return read();
  }
}

export const resultsApi = {
  public() {
    return readWithRetry(() => mobileRequest<PublicSessionResults[]>('/api/mobile/v1/results'));
  },
  mine(accessToken: string) {
    return readWithRetry(() => mobileRequest<PersonalResultsResponse>('/api/mobile/v1/results/me', { accessToken }));
  },
};
