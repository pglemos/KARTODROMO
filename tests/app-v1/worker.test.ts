import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarGateway } from '../../workers/app-operacional/src/index';

const ENV = { ORIGEM_URL: 'https://origem.teste', GATEWAY_SEGREDO: 'segredo-do-gateway' };
const req = (path: string, init: RequestInit = {}) => new Request(`https://operacao.teste${path}`, init);

describe('gateway público', () => {
  let origem: ReturnType<typeof vi.fn>;
  let gateway: ReturnType<typeof criarGateway>;
  beforeEach(() => { origem = vi.fn(async () => new Response('{}', { status: 200 })); gateway = criarGateway(origem as unknown as typeof fetch, { loginPorMinuto: 2 }); });

  it('só repassa /api/app/v1/', async () => {
    expect((await gateway(req('/api/state'), ENV)).status).toBe(404);
    expect((await gateway(req('/api/sessions/x/restart', { method: 'POST' }), ENV)).status).toBe(404);
    expect((await gateway(req('/api/app/v1/../state'), ENV)).status).toBe(404);
    expect(origem).not.toHaveBeenCalled();
    expect((await gateway(req('/api/app/v1/me'), ENV)).status).toBe(200);
    expect(String(origem.mock.calls[0][0].url)).toBe('https://origem.teste/api/app/v1/me');
  });

  it('cabeçalho de gateway do cliente é substituído', async () => {
    await gateway(req('/api/app/v1/me', { headers: { 'x-app-v1-gateway': 'falso', authorization: 'Bearer t' } }), ENV);
    const h = origem.mock.calls[0][0].headers as Headers;
    expect(h.get('x-app-v1-gateway')).toBe('segredo-do-gateway');
    expect(h.get('authorization')).toBe('Bearer t');
  });

  it('usa redirecionamento manual, único modo seguro aceito pelo Workers', async () => {
    await gateway(req('/api/app/v1/me'), ENV);
    expect(origem.mock.calls[0][0].redirect).toBe('manual');
  });

  it('limita login por IP', async () => {
    const login = () => gateway(req('/api/app/v1/auth/login', { method: 'POST', headers: { 'cf-connecting-ip': '1.2.3.4' }, body: '{}' }), ENV);
    expect((await login()).status).toBe(200);
    expect((await login()).status).toBe(200);
    expect((await login()).status).toBe(429);
    expect((await gateway(req('/api/app/v1/auth/login', { method: 'POST', headers: { 'cf-connecting-ip': '5.6.7.8' }, body: '{}' }), ENV)).status).toBe(200);
  });

  it('/events passa em fluxo, sem acumular', async () => {
    const corpo = new ReadableStream();
    origem.mockResolvedValueOnce(new Response(corpo, { headers: { 'content-type': 'text/event-stream' } }));
    const r = await gateway(req('/api/app/v1/events'), ENV);
    expect(r.body).toBe(corpo);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('origem fora responde 503 UNAVAILABLE (T32)', async () => {
    origem.mockRejectedValueOnce(new Error('túnel'));
    const r = await gateway(req('/api/app/v1/me'), ENV);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ codigo: 'UNAVAILABLE' });
  });

  it('sem configuração não repassa nada', async () => {
    expect((await gateway(req('/api/app/v1/me'), { ORIGEM_URL: '', GATEWAY_SEGREDO: '' })).status).toBe(503);
    expect(origem).not.toHaveBeenCalled();
  });
});
