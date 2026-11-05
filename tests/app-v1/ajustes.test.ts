import { describe, it, expect, vi, afterEach } from 'vitest';
import { abrirStore } from '../../lib/app-v1/store';
import { criarOperacao } from '../../lib/app-v1/operacao';
import { pode, criarUsuario, login, autenticar, type Identidade } from '../../lib/app-v1/auth';
const op: Identidade = { usuarioId: 'op', usuario: 'op', nome: 'Operador', perfil: 'OPERACAO', sessaoId: 's', deviceId: 'd', expiraEm: 0 };
const ger = { ...op, perfil: 'GERENCIA' as const }; const rec = { ...op, perfil: 'RECEPCAO' as const };
const eq = { ...op, usuario: 'eq', perfil: 'EQUALIZACAO' as const };
const stores: ReturnType<typeof abrirStore>[] = []; afterEach(() => stores.splice(0).forEach(s => s.fechar()));
function setup() { const store = abrirStore(':memory:'); stores.push(store); const legado = vi.fn(async (_method: string, _path: string, _body?: unknown) => ({})); const api = criarOperacao({ store, legado, verSessao: () => undefined, listarSessoes: () => [], kartsCadastrados: () => ['1', '2', '3'], inscricoes: async () => [] }); return { store, api, legado }; }
const pedido = (payload: object, id: string, rev = 0) => ({ operationId: id, expectedSessionRevision: rev, payload, reason: 'TESTE CODEX' });
describe('frota e aulas', () => {
 it('galpão não acessa equalização nem libera bloqueado', async () => {
   const { api } = setup(); expect(pode('OPERACAO', 'equalizacao.gerir')).toBe(false);
   await api.marcarKart(ger, '2', { reason: 'Equalizar', estado: 'equalizar' });
   await expect(api.marcarKart(op, '2', { fora: false })).rejects.toThrow(/permissão/i);
   expect(api.frota().fora).toEqual([expect.objectContaining({ kart: '2', estado: 'equalizar' })]);
   expect(api.resumoDoDia([]).frota).toMatchObject({ disponiveis: 0, oficina: 0, equalizar: 1 });
 });
 it('responsável por equalização tem perfil próprio sem gerir usuários', async () => {
   const { store } = setup(); const ctx = { store, segredo: 'x'.repeat(40) };
   await criarUsuario(ctx, { usuario: 'equalizador', nome: 'Equalizador', senha: 'teste-forte-123', perfil: 'EQUALIZACAO' });
   const t = await login(ctx, 'equalizador', 'teste-forte-123', 'tablet'); const q = autenticar(ctx, `Bearer ${t.accessToken}`)!;
   expect(q.perfil).toBe('EQUALIZACAO'); expect(pode(q.perfil, 'equalizacao.gerir')).toBe(true); expect(pode(q.perfil, 'usuarios.gerir')).toBe(false);
 });
 it('responsável por equalização não libera kart em oficina', async () => {
   const { api } = setup(); await api.marcarKart(ger, '2', { fora: true, estado: 'oficina', reason: 'quebra' });
   await expect(api.marcarKart(eq, '2', { fora: false, reason: 'liberação' })).rejects.toThrow(/equalizar/i);
   expect(api.frota().fora).toEqual([expect.objectContaining({ kart: '2', estado: 'oficina' })]);
 });
 it('recibo fica pendente; somente recepção ou gerência aceita; repetição não duplica', async () => {
   const { api } = setup(); const p = pedido({ instrutor: 'Anderson', pilotos: 3, aulas: 2, valorCentavos: 15000 }, 'aula-1');
   expect((await api.registrarAula(op, p)).status).toBe('APPLIED');
   expect((await api.registrarAula(op, p)).status).toBe('APPLIED');
   const lista = api.aulas(); expect(lista.recibos).toHaveLength(1); expect(lista.recibos[0].aceitoEm).toBeNull();
   await expect(api.aceitarAula(op, 'aula-1', pedido({}, 'aceite-errado', 1))).rejects.toThrow();
   expect((await api.aceitarAula(rec, 'aula-1', pedido({}, 'aceite-1', 1))).status).toBe('APPLIED');
   expect(api.aulas().recibos[0].aceitoPor).toBe('op');
 });
 it.each([{ instrutor: 'Outro', pilotos: 1, aulas: 1, valorCentavos: 1 }, { instrutor: 'Anderson', pilotos: 0, aulas: 1, valorCentavos: 100 }, { instrutor: 'Felisberto', pilotos: 1, aulas: 1, valorCentavos: NaN }])('recusa aula inválida %j', async p => {
   const { api } = setup(); await expect(api.registrarAula(op, pedido(p, 'ruim'))).rejects.toThrow(); expect(api.aulas().recibos).toHaveLength(0);
 });
});

it('confirmação manual libera o kart e mantém a indicação não testado na frota', async () => {
 const { api } = setup(); await api.marcarKart(ger, '2', { estado: 'equalizar', reason: 'TESTE CODEX' });
 expect((await api.comandoEqualizacao(ger, 'eq', pedido({ acao: 'checklist', kart: '2', confirmacaoMm: 0, semTeste: true }, 'manual'))).status).toBe('APPLIED');
 expect(api.frota().fora).toHaveLength(0); expect(api.frota().semTeste).toEqual([expect.objectContaining({ kart: '2', sessionId: 'eq' })]);
});

it('responsável por equalização não limpa bloqueio de oficina pelo checklist', async () => {
 const { api, store } = setup(); await api.marcarKart(ger, '2', { fora: true, estado: 'oficina', reason: 'quebra' });
 const resultado = await api.comandoEqualizacao(eq, 'eq-oficina', pedido({ acao: 'checklist', kart: '2', confirmacaoMm: 0, semTeste: true }, 'manual-oficina'));
 expect(resultado).toMatchObject({ status: 'REJECTED' });
 expect(api.frota().fora).toEqual([expect.objectContaining({ kart: '2', estado: 'oficina' })]);
 expect(store.db.prepare('SELECT COUNT(*) n FROM karts_sem_teste').get()).toMatchObject({ n: 0 });
});

it('revalida dentro da transação antes de retirar bloqueio no checklist', async () => {
 const { api, store, legado } = setup(); await api.marcarKart(ger, '2', { estado: 'equalizar', reason: 'TESTE CODEX' });
 legado.mockImplementation(async (method) => {
   if (method === 'GET') return { resultado: { karts: [{ kart: '2', checklist: null }] } };
   store.db.prepare("UPDATE karts_fora SET estado = 'oficina' WHERE kart = '2'").run();
   return {};
 });
 const resultado = await api.comandoEqualizacao(eq, 'eq-race', pedido({ acao: 'checklist', kart: '2', confirmacaoMm: 0, semTeste: true }, 'manual-race'));
 expect(resultado).toMatchObject({ status: 'REJECTED' });
 expect(api.frota().fora).toEqual([expect.objectContaining({ kart: '2', estado: 'oficina' })]);
 expect(store.db.prepare('SELECT COUNT(*) n FROM karts_sem_teste').get()).toMatchObject({ n: 0 });
});

it('kart em Equalizar pode ser confirmado sem sessão ou volta de teste e o reenvio não duplica', async () => {
 const { api } = setup(); await api.marcarKart(ger, '2', { estado: 'equalizar', reason: 'TESTE CODEX' });
 const p = pedido({ equalizadoSemTeste: true, ajusteMm: 0.5 }, 'manual-frota', api.frota().sessionRevision);
 expect(await api.marcarKart(ger, '2', p)).toMatchObject({ status: 'APPLIED' });
 expect(await api.marcarKart(ger, '2', p)).toMatchObject({ status: 'APPLIED' });
 expect(api.frota().fora).toHaveLength(0); expect(api.frota().semTeste).toEqual([expect.objectContaining({ kart: '2', ajusteMm: 0.5 })]);
});
it('mudança de frota com envelope é auditada uma única vez', async () => {
 const { api, store } = setup(); const p = pedido({ fora: true }, 'oficina-idempotente');
 expect(await api.marcarKart(ger, '2', p)).toMatchObject({ status: 'APPLIED' }); expect(await api.marcarKart(ger, '2', p)).toMatchObject({ status: 'APPLIED' });
 expect(store.db.prepare("SELECT COUNT(*) n FROM operacoes WHERE operationId = 'oficina-idempotente'").get()).toMatchObject({ n: 1 });
 expect(store.db.prepare("SELECT COUNT(*) n FROM auditoria WHERE action = 'fleet'").get()).toMatchObject({ n: 1 });
});

it('ordem de serviço exige kart na oficina, mecânico e mantém liberação separada', async () => {
 const { api, store } = setup();
 await api.marcarKart(ger, '2', { reason: 'motor', operationId: 'bloqueio-os', expectedSessionRevision: 0, payload: { estado: 'oficina' } });
 const criar = pedido({ kart: '2', motivo: 'Falha no motor', mecanico: 'Carlos' }, 'os-1', 0);
 await expect(api.criarOrdemServico(op, criar)).rejects.toThrow(/permissão/i);
 expect((await api.criarOrdemServico(ger, criar)).status).toBe('APPLIED');
 expect((await api.criarOrdemServico(ger, criar)).status).toBe('APPLIED');
 expect(api.ordensServico().ordens).toEqual([expect.objectContaining({ id: 'os-1', kart: '2', mecanico: 'Carlos', status: 'aberta' })]);
 const iniciar = pedido({ status: 'em_execucao' }, 'os-2', 1);
 expect((await api.atualizarOrdemServico(ger, 'os-1', iniciar)).status).toBe('APPLIED');
 const concluir = pedido({ status: 'concluida' }, 'os-3', 2);
 expect((await api.atualizarOrdemServico(ger, 'os-1', concluir)).status).toBe('APPLIED');
 expect(api.frota().fora).toHaveLength(1);
 expect(store.db.prepare("SELECT COUNT(*) n FROM auditoria WHERE action LIKE 'work-order-%'").get()).toMatchObject({ n: 3 });
});

it('ordem de serviço recusa kart livre, mecânico vazio e transição inválida', async () => {
 const { api } = setup();
 await expect(api.criarOrdemServico(ger, pedido({ kart: '2', motivo: 'motor', mecanico: '' }, 'os-sem-mecanico'))).rejects.toThrow(/mecânico/i);
 expect(await api.criarOrdemServico(ger, pedido({ kart: '2', motivo: 'motor', mecanico: 'Carlos' }, 'os-kart-livre'))).toMatchObject({ status: 'REJECTED', erro: expect.stringMatching(/oficina/i) });
 await api.marcarKart(ger, '2', { fora: true, reason: 'motor' });
 await api.criarOrdemServico(ger, pedido({ kart: '2', motivo: 'motor', mecanico: 'Carlos' }, 'os-transicao'));
 expect(await api.atualizarOrdemServico(ger, 'os-transicao', pedido({ status: 'concluida' }, 'os-pular', 1))).toMatchObject({ status: 'REJECTED', erro: expect.stringMatching(/transição/i) });
});
