import { beforeAll, afterAll, it, expect } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { abrirStore } from '../../lib/app-v1/store';
import { criarUsuario } from '../../lib/app-v1/auth';
import { createSession } from '../../lib/timing/race-engine';
const raiz = process.cwd(); const pasta = mkdtempSync(join(tmpdir(), 'operacao-integracao-')); const data = join(pasta, 'timing');
let base = ''; let porta = 0; const senha = randomBytes(24).toString('hex'); const segredo = randomBytes(32).toString('hex');
let processo: ChildProcess; let logs = '';
const req = async (path: string, token?: string, body?: unknown, method = 'POST') => {
 const r = await fetch(base + path, { method: body === undefined ? 'GET' : method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 return { http: r.status, body: await r.json() };
};
const login = async (usuario: string) => (await req('/api/app/v1/auth/login', undefined, { usuario, senha, deviceId: 'TESTE CODEX' })).body.accessToken as string;
const comando = async (token: string, id: string, rota: string, payload: object, operationId: string) => {
 const s = await req(`/api/app/v1/sessions/${id}`, token);
 return req(`/api/app/v1/sessions/${id}/${rota}`, token, { operationId, expectedSessionRevision: s.body.sessionRevision, payload, reason: 'TESTE CODEX' });
};
beforeAll(async () => {
 const reserva = net.createServer(); await new Promise<void>(r => reserva.listen(0, '127.0.0.1', r)); porta = (reserva.address() as net.AddressInfo).port; await new Promise<void>(r => reserva.close(() => r())); base = `http://127.0.0.1:${porta}`;
 mkdirSync(join(data, 'sessions'), { recursive: true });
 writeFileSync(join(data, 'transponders.json'), JSON.stringify({ map: { '111': '1', '112': '2', '113': '3', '211': '101', '212': '102' } }));
 for (const [id, type, programaId] of [['tomada-teste', 'classificacao', 'TESTE CODEX'], ['corrida-teste', 'corrida', 'TESTE CODEX'], ['tomada-falha', 'classificacao', 'falha-de-gravacao'], ['corrida-falha', 'corrida', 'falha-de-gravacao']] as const) {
  const s = createSession({ id, name: 'TESTE CODEX', type, durationMin: 20, now: Date.now(), competitors: [{ kart: '1', name: 'TESTE CODEX Ana', customerId: 'a' }, { kart: '2', name: 'TESTE CODEX Bia', customerId: 'b' }] }); s.programaId = programaId;
  writeFileSync(join(data, 'sessions', `${id}.json`), JSON.stringify(s));
 }
 const inicioRecuperacao = Date.now() - 180000;
 const recuperacao = createSession({ id: 'recuperacao-teste', name: 'TESTE CODEX', type: 'corrida', durationMin: 20, now: inicioRecuperacao, competitors: [{ kart: '1', name: 'TESTE CODEX Ana', customerId: 'a' }, { kart: '2', name: 'TESTE CODEX Bia', customerId: 'b' }] });
 recuperacao.state = 'em_andamento'; recuperacao.startedAt = inicioRecuperacao; recuperacao.currentFlag = 'green';
 recuperacao.competitors[0].crossings = [{ id: 'a0', wallMs: inicioRecuperacao, decoderTimeMs: inicioRecuperacao % 86400000, lapMs: null, source: 'decoder' }];
 recuperacao.competitors[1].crossings = [0, 60000, 120000].map((t, i) => ({ id: `b${i}`, wallMs: inicioRecuperacao + t, decoderTimeMs: (inicioRecuperacao + t) % 86400000, lapMs: i ? 60000 : null, source: 'decoder' }));
 writeFileSync(join(data, 'sessions', `${recuperacao.id}.json`), JSON.stringify(recuperacao));
 const historica = createSession({ id: 'historica-teste', name: 'TESTE CODEX · histórico', type: 'treino', durationMin: 20, now: Date.now() - 10 * 86400000, competitors: [{ kart: '1', name: 'TESTE CODEX' }] });
 historica.state = 'encerrada'; historica.competitors[0].crossings = [0, 60000].map((t, i) => ({ id: `h${i}`, wallMs: historica.createdAt + t, decoderTimeMs: t, lapMs: i ? 60000 : null, source: 'decoder' }));
 writeFileSync(join(data, 'sessions', `${historica.id}.json`), JSON.stringify(historica));
 const store = abrirStore(join(pasta, 'app-operacional', 'app.db'));
 for (const [usuario, perfil] of [['ger', 'GERENCIA'], ['op', 'OPERACAO'], ['rec', 'RECEPCAO']] as const) await criarUsuario({ store, segredo }, { usuario, nome: 'TESTE CODEX', perfil, senha }); store.fechar();
 processo = spawn(join(raiz, 'node_modules', '.bin', 'tsx'), [join(raiz, 'services/timing-server.ts')], { cwd: pasta, env: { NODE_ENV: 'test', PATH: process.env.PATH, HOME: process.env.HOME, TIMING_PORT: String(porta), TIMING_SIMULATE: '1', TIMING_SIM_PORT: '0', TIMING_DECODER_PROTOCOL: 'trx', TIMING_DATA_DIR: data, APP_V1_TOKEN_SECRET: segredo, OPS_URL: 'http://127.0.0.1:9' }, stdio: ['ignore', 'pipe', 'pipe'] });
 processo.stdout?.on('data', b => { logs += b.toString(); }); processo.stderr?.on('data', b => { logs += b.toString(); });
 for (let i = 0; i < 100; i++) { try { if ((await req('/api/app/v1/me')).http === 401) return; } catch {} if (processo.exitCode != null) throw new Error(`Simulador não iniciou: ${logs}`); await new Promise(r => setTimeout(r, 100)); }
 throw new Error('Simulador não respondeu em 10 segundos.');
}, 20000);
afterAll(async () => { if (processo && processo.exitCode == null) { processo.kill('SIGTERM'); await new Promise<void>(r => processo.once('exit', () => r())); } rmSync(pasta, { recursive: true, force: true }); });
it('servidor real integra punição, grid, bloqueio nativo, equalização mista e recibos', async () => {
 const ger = await login('ger'); const op = await login('op'); const rec = await login('rec'); expect(ger && op && rec).toBeTruthy();
 const abertura = (await req('/api/app/v1/fleet', ger)).body.abertura;
 expect(abertura.liberados).toBe(0);
 expect((await req('/api/sessions/tomada-teste/sorteio', undefined, { atribuicoes: [{ indice: 0, kart: '3' }] })).http).toBe(400);
 const abrir = async (acao: string, payload: object, token = ger) => {
   const f = (await req('/api/app/v1/fleet', token)).body;
   return req(`/api/app/v1/fleet/opening/${acao}`, token, { operationId: `abertura-${acao}-${f.sessionRevision}`, expectedSessionRevision: f.sessionRevision, reason: 'TESTE CODEX', payload: { dia: f.abertura.dia, ...payload } });
 };
 expect((await abrir('aceitar', { karts: ['1'] }, op)).http).toBe(403);
 expect((await abrir('conferir', { karts: ['1'], itens: ['freioAcelerador', 'pneus', 'corrente', 'combustivel'] }, op)).body.status).toBe('APPLIED');
 expect((await abrir('aceitar', { karts: ['1'] })).body.status).toBe('APPLIED');
 expect((await req('/api/app/v1/fleet', ger)).body.abertura.liberados).toBe(1);
 expect((await comando(op, 'tomada-teste', 'penalties', { kart: '1', tipo: 'advertencia', infracao: 'largar-ultimo' }, 'grid')).body.status).toBe('APPLIED');
 expect((await req('/api/sessions/corrida-teste')).body.competitors.map((c: any) => c.kart)).toEqual(['2', '1']);
 for (let i = 0; i < 3; i++) expect((await comando(op, 'tomada-teste', 'penalties', { kart: '2', tipo: 'advertencia', infracao: 'perigosa' }, `alerta-${i}`)).body.status).toBe('APPLIED');
 expect((await req('/api/app/v1/sessions/tomada-teste/live', op)).body.standings.find((x: any) => x.kart === '2').desclassificado).toBe(true);
 expect((await req('/api/app/v1/fleet/2', ger, { estado: 'equalizar', reason: 'TESTE CODEX' })).http).toBe(200);
 expect((await req('/api/app/v1/fleet/2', op, { fora: false })).http).toBe(403);
 const bloqueio = await req('/api/sessions/corrida-teste/swap-kart', undefined, { fromKart: '1', toKart: '2' }); expect(bloqueio.http).toBe(409); expect(bloqueio.body.error).toMatch(/bloqueado/);
 const frota = (await req('/api/app/v1/fleet', ger)).body;
 expect((await req('/api/app/v1/fleet/2', ger, { operationId: 'manual-sem-sessao', expectedSessionRevision: frota.sessionRevision, payload: { equalizadoSemTeste: true, ajusteMm: '0,5' }, reason: 'TESTE CODEX' })).body.status).toBe('APPLIED');
 expect((await req('/api/app/v1/fleet', ger)).body.semTeste).toEqual([expect.objectContaining({ kart: '2', ajusteMm: 0.5 })]);
 const historico = (await req('/api/app/v1/equalization/compare?kart=1&referencia=2', ger)).body; expect(historico.kart.voltas).toHaveLength(1); expect(historico.kart.voltas[0].lapMs).toBe(60000);
 const regras = (await req('/api/app/v1/equalization/options', ger)).body.regras;
 const eq = await req('/api/app/v1/equalization/create', ger, { operationId: 'eq-mista', expectedSessionRevision: 0, payload: { nome: 'TESTE CODEX', frotas: { LIGHT: { referencias: ['1'], regra: regras[0].id }, SUPER: { referencias: ['101'], regra: regras[regras.length - 1].id } } }, reason: 'TESTE CODEX' });
 expect(eq.body.status).toBe('APPLIED'); const eqId = eq.body.resultado.id;
 const detalhe = (await req(`/api/app/v1/equalization/${eqId}`, ger)).body; expect(Object.keys(detalhe.resultado.frotas)).toEqual(['LIGHT', 'SUPER']);
 expect((await req('/api/app/v1/equalization', op)).http).toBe(403);
 const aula = { operationId: 'aula-teste', expectedSessionRevision: 0, payload: { instrutor: 'Felisberto', pilotos: 4, aulas: 2, valorCentavos: 18000 }, reason: 'TESTE CODEX' };
 expect((await req('/api/app/v1/lessons/create', op, aula)).body.status).toBe('APPLIED'); expect((await req('/api/app/v1/lessons/create', op, aula)).body.status).toBe('APPLIED');
 const lista = (await req('/api/app/v1/lessons', rec)).body; expect(lista.recibos).toHaveLength(1); expect(lista.recibos[0].aceitoEm).toBeNull();
 expect((await req('/api/app/v1/lessons/aula-teste/accept', rec, { operationId: 'aceitar-teste', expectedSessionRevision: lista.sessionRevision, payload: {}, reason: 'TESTE CODEX' })).body.status).toBe('APPLIED');
 expect((await req('/api/app/v1/fleet/3', ger, { estado: 'oficina', reason: 'TESTE CODEX' })).http).toBe(200);
 expect((await req('/api/app/v1/maintenance/orders', op)).http).toBe(403);
 const os = await req('/api/app/v1/maintenance/orders/create', ger, { operationId: 'os-teste', expectedSessionRevision: 0, payload: { kart: '3', motivo: 'Falha no motor', mecanico: 'TESTE CODEX Carlos' }, reason: 'TESTE CODEX' });
 expect(os.body.status).toBe('APPLIED'); expect((await req('/api/app/v1/maintenance/orders', ger)).body.ordens[0]).toMatchObject({ kart: '3', mecanico: 'TESTE CODEX Carlos', status: 'aberta' });
 expect((await req('/api/app/v1/maintenance/orders/os-teste/status', ger, { operationId: 'os-iniciar', expectedSessionRevision: 1, payload: { status: 'em_execucao' }, reason: 'TESTE CODEX' })).body.status).toBe('APPLIED');
 expect((await req('/api/app/v1/maintenance/orders/os-teste/status', ger, { operationId: 'os-concluir', expectedSessionRevision: 2, payload: { status: 'concluida' }, reason: 'TESTE CODEX' })).body.status).toBe('APPLIED');
 expect((await req('/api/app/v1/fleet', ger)).body.fora).toEqual(expect.arrayContaining([expect.objectContaining({ kart: '3', estado: 'oficina' })]));
}, 15000);

it('passagem direta exige autorização destrutiva e recuperação repetida não duplica voltas', async () => {
 const caminho = '/api/sessions/recuperacao-teste/passings/recover';
 const body = { kart: '1', referencia: '2', quantidade: 2, posicao: 2, operationId: 'recuperacao-idempotente', motivo: 'TESTE CODEX' };
 const bloqueada = await fetch(base + caminho, { method: 'POST', headers: { 'content-type': 'application/json', 'x-public-bridge': '1' }, body: JSON.stringify(body) });
 expect(bloqueada.status).toBe(403);
 expect((await req(caminho, undefined, body)).http).toBe(200);
 const antes = (await req('/api/sessions/recuperacao-teste/passings')).body.filter((x: any) => x.kart === '1').length;
 expect((await req(caminho, undefined, body)).http).toBe(200);
 const depois = (await req('/api/sessions/recuperacao-teste/passings')).body.filter((x: any) => x.kart === '1').length;
 expect(depois).toBe(antes);
}, 15000);

it('posição manual aumenta a revisão usada por outras telas', async () => {
 const ger = await login('ger');
 await req('/api/sessions/corrida-falha/position', undefined, { kart: '1', position: 1, autor: 'TESTE CODEX' });
 const antes = await req('/api/app/v1/sessions/corrida-falha', ger);
 expect((await req('/api/sessions/corrida-falha/position', undefined, { kart: '1', position: 2, autor: 'TESTE CODEX' })).http).toBe(200);
 const depois = await req('/api/app/v1/sessions/corrida-falha', ger);
 expect(depois.body.sessionRevision).toBeGreaterThan(antes.body.sessionRevision);
});

it('punição de grid não persiste só uma das baterias se a segunda gravação falhar', async () => {
 const arquivoTomada = join(data, 'sessions', 'tomada-falha.json');
 rmSync(arquivoTomada, { recursive: true, force: true }); mkdirSync(arquivoTomada);
 const op = await login('op');
 const antesTomada = (await req('/api/sessions/tomada-falha')).body;
 const antesCorrida = (await req('/api/sessions/corrida-falha')).body;
 const resultado = await comando(op, 'tomada-falha', 'penalties', { kart: '1', tipo: 'advertencia', infracao: 'largar-ultimo' }, 'grid-gravacao-falha');
 expect(resultado.body.status).not.toBe('APPLIED');
 expect((await req('/api/sessions/tomada-falha')).body).toEqual(antesTomada);
 expect((await req('/api/sessions/corrida-falha')).body).toEqual(antesCorrida);
}, 15000);
