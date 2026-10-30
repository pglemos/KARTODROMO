import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateMobileRequest } from '../../workers/pre-cadastro/src/mobile/auth';
import { handleMobileRanking } from '../../workers/pre-cadastro/src/mobile/ranking';

vi.mock('../../workers/pre-cadastro/src/mobile/auth', () => ({ authenticateMobileRequest: vi.fn() }));
const first = vi.fn(async () => null);
const prepare = vi.fn(() => ({ bind: () => ({ first }) }));
const env = { MOBILE_DB: { prepare }, MOBILE_ADMIN_TOKEN: 'synthetic-admin-token' };
const account = { id: 'test-account', name: 'TESTE CODEX', email: 'teste@example.com', cpf: '12345678909', phone: '31999999999' };

beforeEach(() => { vi.clearAllMocks(); });
describe('autenticação da carreira e da foto', () => {
  it.each(['/api/mobile/v1/ranking/me', '/api/mobile/v1/ranking/me/foto'])('responde 401 para sessão expirada em %s', async path => {
    vi.mocked(authenticateMobileRequest).mockResolvedValue(null);
    const result = await handleMobileRanking(new Request('https://example.com'+path, { method: path.endsWith('/foto') ? 'PUT' : 'GET' }), env as never);
    expect(result.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });
  it.each(['/api/mobile/v1/ranking/me', '/api/mobile/v1/ranking/me/foto'])('mantém 404 para conta válida sem vínculo em %s', async path => {
    vi.mocked(authenticateMobileRequest).mockResolvedValue(account);
    const result = await handleMobileRanking(new Request('https://example.com'+path, { method: path.endsWith('/foto') ? 'PUT' : 'GET' }), env as never);
    expect(result.status).toBe(404);
  });
});
