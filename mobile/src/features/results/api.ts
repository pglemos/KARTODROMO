import { mobileRequest } from '../../api/client';
import type { PersonalResultsResponse, PublicSessionResults } from './types';

export const resultsApi = {
  public() {
    return mobileRequest<PublicSessionResults[]>('/api/mobile/v1/results');
  },
  mine(accessToken: string) {
    return mobileRequest<PersonalResultsResponse>('/api/mobile/v1/results/me', { accessToken });
  },
};
