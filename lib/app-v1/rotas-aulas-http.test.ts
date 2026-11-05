import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../timing/sse', () => ({ writeTimingEvent: () => undefined }));

import { criarUsuario } from './auth';
import { criarModuloApp } from './rotas';
import { abrirStore } from './store';

const SENHA = 'senha-de-teste-12';
let servidor: http.Server;
let base = '';
const chamadasLegado: string[] = [];

async function chamar(metodo: string, caminho: string, token?: string, corpo?: unknown) {
  const r = await fetch(base + caminho, { method: metodo, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: r.status, json: await r.json() as Record<string, any> };
}
const entrar = async (usuario: string) => (await chamar('POST', '/api/app/v1/auth/login', undefined, { usuario, senha: SENHA, deviceId: `dev-${usuario}` })).json.accessToken as string;

beforeAll(async () => {
  const store = abrirStore(':memory:');
  const segredo = 'x'.repeat(40);
  for (const [usuario, perfil] of [['ger', 'GERENCIA'], ['op', 'OPERACAO'], ['rec', 'RECEPCAO']] as const) await criarUsuario({ store, segredo }, { usuario, nome: usuario, perfil, senha: SENHA });
  const modulo = criarModuloApp({
    store, segredo, listarSessoes: () => [], verSessao: () => null, assinarMudancas: () => () => undefined,
    legado: async (_m, caminho) => { chamadasLegado.push(caminho); return [{ sessionId: 's1', data: '2026-11-03', hora: '19:20', melhorMs: 61_000, voltas: 5 }]; },
    inscricoes: async () => [],
  });
  servidor = http.createServer(async (req, res) => { if (!(await modulo.tratar(req, res, new URL(req.url ?? '/', 'http://x')))) { res.statusCode = 404; res.end('{}'); } });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => servidor.close());

describe('rotas de aulas, manutenção e comparação por HTTP', () => {
  it('fluxo completo de recibo: operação registra, recepção aceita, permissões respeitadas', async () => {
    const [op, rec, ger] = [await entrar('op'), await entrar('rec'), await entrar('ger')];
    const inicial = await chamar('GET', '/api/app/v1/lessons', rec);
    expect(inicial.status).toBe(200);
    expect(inicial.json.sessionRevision).toBe(0);
    const pedido = { operationId: 'r-1', expectedSessionRevision: 0, payload: { instrutor: 'Anderson', pilotos: 2, aulas: 2, valorCentavos: 30000 }, reason: 'teste' };
    expect((await chamar('POST', '/api/app/v1/lessons/create', rec, pedido)).status).toBe(403);
    const criado = await chamar('POST', '/api/app/v1/lessons/create', op, pedido);
    expect(criado.json.status).toBe('APPLIED');
    const lista = await chamar('GET', '/api/app/v1/lessons', ger);
    expect(lista.json.recibos).toHaveLength(1);
    const id = lista.json.recibos[0].id;
    expect((await chamar('POST', `/api/app/v1/lessons/${id}/accept`, op, { operationId: 'r-2', expectedSessionRevision: 1, payload: {} })).status).toBe(403);
    expect((await chamar('POST', `/api/app/v1/lessons/${id}/accept`, rec, { operationId: 'r-2', expectedSessionRevision: 1, payload: {} })).json.status).toBe('APPLIED');
    expect((await chamar('GET', '/api/app/v1/lessons', rec)).json.recibos[0].aceitoPor).toBe('rec');
  });

  it('ordens de serviço: só gerência; operação e anônimo recusados; /me lista as capacidades novas', async () => {
    const [op, ger] = [await entrar('op'), await entrar('ger')];
    expect((await chamar('GET', '/api/app/v1/maintenance/orders', op)).status).toBe(403);
    expect((await chamar('GET', '/api/app/v1/maintenance/orders')).status).toBe(401);
    const lista = await chamar('GET', '/api/app/v1/maintenance/orders', ger);
    expect(lista.status).toBe(200);
    expect(lista.json.ordens).toEqual([]);
    const eu = await chamar('GET', '/api/app/v1/me', ger);
    expect(eu.json.capacidades).toEqual(expect.arrayContaining(['aulas.registrar', 'aulas.aceitar', 'manutencao.gerir']));
    expect((await chamar('GET', '/api/app/v1/me', op)).json.capacidades).not.toContain('manutencao.gerir');
  });

  it('comparação: exige permissão de equalização, valida e consulta o ranking para os dois karts', async () => {
    const [rec, ger] = [await entrar('rec'), await entrar('ger')];
    expect((await chamar('GET', '/api/app/v1/equalization/compare?kart=7&referencia=9', rec)).status).toBe(403);
    expect((await chamar('GET', '/api/app/v1/equalization/compare?kart=7&referencia=101', ger)).status).toBe(400);
    const r = await chamar('GET', '/api/app/v1/equalization/compare?kart=7&referencia=9&trackId=t1', ger);
    expect(r.status).toBe(200);
    expect(r.json.kart).toMatchObject({ numero: '7', amostra: 5 });
    expect(r.json.referencia.voltas[0].lapMs).toBe(61_000);
    expect(chamadasLegado.filter((c) => c.includes('trackId=t1'))).toHaveLength(2);
  });
});
