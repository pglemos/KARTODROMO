import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminCookieName, createAdminSession } from '@/lib/admin-auth';
import { canWriteTelao, denyTelaoWrite } from '@/lib/telao-write-auth';

const ENV_KEYS = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'TELAO_WRITE_KEY'] as const;
const saved: Record<string, string | undefined> = {};

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { method: 'PUT', headers: { host: new URL(url).host, ...headers } });
}

describe('gravação nas rotas do telão', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.ADMIN_EMAIL = 'admin@teste.local';
    process.env.ADMIN_PASSWORD = 'senha-de-teste';
    process.env.ADMIN_SESSION_SECRET = 'segredo-de-teste';
    delete process.env.TELAO_WRITE_KEY;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('recusa quem vem da internet sem sessão', async () => {
    const req = request('https://kartodromodebetim.com.br/api/telao-layout', { 'cf-connecting-ip': '203.0.113.9' });
    expect(canWriteTelao(req)).toBe(false);
    expect(denyTelaoWrite(req)?.status).toBe(401);
  });

  it('aceita a sessão do admin', () => {
    const cookie = `outro=1; ${adminCookieName()}=${createAdminSession('admin@teste.local')}`;
    const req = request('https://kartodromodebetim.com.br/api/telao-layout', { cookie, 'cf-connecting-ip': '203.0.113.9' });
    expect(denyTelaoWrite(req)).toBeNull();
  });

  it('recusa sessão adulterada', () => {
    const cookie = `${adminCookieName()}=${createAdminSession('admin@teste.local')}x`;
    expect(canWriteTelao(request('https://kartodromodebetim.com.br/api/telao-layout', { cookie }))).toBe(false);
  });

  it('aceita script na própria máquina', () => {
    expect(canWriteTelao(request('http://127.0.0.1:3000/api/tb50-display-mode'))).toBe(true);
    expect(canWriteTelao(request('http://localhost:3100/api/viplex-programs'))).toBe(true);
  });

  it('recusa host local quando o pedido passou por túnel ou proxy', () => {
    expect(canWriteTelao(request('http://127.0.0.1:3000/api/telao-layout', { 'cf-connecting-ip': '203.0.113.9' }))).toBe(false);
    expect(canWriteTelao(request('http://localhost:3000/api/telao-layout', { 'x-forwarded-for': '203.0.113.9' }))).toBe(false);
  });

  it('aceita a chave de serviço só quando confere', () => {
    process.env.TELAO_WRITE_KEY = 'chave-de-teste';
    const url = 'https://kartodromodebetim.com.br/api/tb50-page';
    expect(canWriteTelao(request(url, { 'x-telao-key': 'chave-de-teste' }))).toBe(true);
    expect(canWriteTelao(request(url, { 'x-telao-key': 'chave-errada!' }))).toBe(false);
  });

  it('todas as rotas de gravação do telão chamam a checagem', () => {
    const routes = ['telao-layout', 'telao-playlist', 'telao-upload', 'tb50-display-mode', 'tb50-page', 'viplex-programs'];
    for (const route of routes) {
      const source = readFileSync(`app/api/${route}/route.ts`, 'utf8');
      const writers = source.match(/export async function (PUT|POST|PATCH|DELETE)\([^)]*\) \{\n[^\n]*/g) ?? [];
      expect(writers.length, route).toBeGreaterThan(0);
      for (const writer of writers) expect(writer, route).toContain('denyTelaoWrite(request)');
    }
  });
});
