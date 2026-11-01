import { beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { criarOperacao } from '../../lib/app-v1/operacao';
import { elegibilidade, planoLastro } from '../../lib/app-v1/regras';
import type { Identidade } from '../../lib/app-v1/auth';

const OP: Identidade = { usuarioId: 'u', usuario: 'op', nome: 'Op', perfil: 'OPERACAO', sessaoId: 's', deviceId: 'd', expiraEm: 0 };
const REC: Identidade = { ...OP, perfil: 'RECEPCAO' };
const ok = { aprovada: true, pago: true, termo: true, totalCentavos: 5000, endurance: false };

describe('elegibilidade', () => {
  const i = (x: object) => elegibilidade({ clienteId: 1, nome: 'A', ...ok, ...x });
  it('aprovado, pago e com termo', () => expect(i({}).situacao).toBe('ELEGIVEL'));
  it('não aprovado', () => expect(i({ aprovada: false }).motivo).toMatch(/aprovado/));
  it('sem termo, mesmo em Endurance', () => expect(i({ termo: false, endurance: true }).motivo).toMatch(/termo/));
  it('aprovado sem pagar', () => expect(i({ pago: false }).motivo).toMatch(/Pagamento/));
  it('exceções ao pagamento', () => {
    expect(i({ pago: false, endurance: true }).situacao).toBe('ELEGIVEL');
    expect(i({ pago: false, totalCentavos: 0 }).situacao).toBe('ELEGIVEL');
  });
  it('dado ausente bloqueia', () => expect(i({ pago: null }).situacao).toBe('INDETERMINADA'));
  it('bit do SQL Server (1/0)', () => expect(i({ aprovada: 1, pago: 1, termo: 1, endurance: 0 }).situacao).toBe('ELEGIVEL'));
});

describe('lastro igual ao APK 1.6', () => {
  it.each([
    ['LIGHT', 60, 30, 6, 0, 90], ['LIGHT', 72.5, 17.5, 3, 1, 90], ['LIGHT', 89, 2.5, 0, 1, 91.5], ['LIGHT', 90, 0, 0, 0, 90], ['LIGHT', 95, 0, 0, 0, 95],
    ['SUPER', 80, 20, 4, 0, 100], ['SUPER', 100, 0, 0, 0, 100], ['SUPER', 110, 0, 0, 0, 110],
  ] as const)('%s %s kg', (f, peso, lastro, p5, p25, final) => {
    expect(planoLastro(peso, f)).toMatchObject({ lastroKg: lastro, pecas5: p5, pecas2_5: p25, finalKg: final });
  });
});

describe('operação', () => {
  let store: AppStore; let legado: ReturnType<typeof vi.fn>; let bateria: any; let insc: any[]; let op: ReturnType<typeof criarOperacao>;
  const envio = (payload: object, extra: object = {}) => ({ operationId: Math.random().toString(36), expectedSessionRevision: 0, payload, reason: 'motivo', ...extra });
  beforeEach(() => {
    store = abrirStore(':memory:');
    legado = vi.fn(async () => ({}));
    bateria = { id: 'b', name: 'B', state: 'preparando', agendaId: 9, competitors: [
      { kart: '4', name: 'Ana', customerId: '1' }, { kart: '', name: 'Bia', customerId: '2' }, { kart: '', name: 'Cid', customerId: '3' },
    ] };
    insc = [{ clienteId: 1, nome: 'Ana', ...ok }, { clienteId: 2, nome: 'Bia', ...ok }, { clienteId: 3, nome: 'Cid', ...ok, pago: false }];
    op = criarOperacao({ store, legado: legado as never, verSessao: (id) => (id === 'b' ? bateria : undefined), inscricoes: async () => insc });
  });

  it('não elegível não grava mesmo com tela adulterada (T01, T02)', async () => {
    const r = await op.sorteio(OP, 'b', envio({ atribuicoes: [{ customerId: '3', nome: 'Cid', kart: '8' }] }));
    expect(r).toMatchObject({ status: 'REJECTED' });
    expect(r.erro).toMatch(/Pagamento/);
    expect(legado).not.toHaveBeenCalled();
  });

  it('recepção fora do ar bloqueia', async () => {
    op = criarOperacao({ store, legado: legado as never, verSessao: () => bateria, inscricoes: async () => { throw new Error('sql'); } });
    const r = await op.sorteio(OP, 'b', envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '8' }] }));
    expect(r.status).toBe('REJECTED');
    expect(legado).not.toHaveBeenCalled();
  });

  it('atrasado entra sem mexer nos outros (T07)', async () => {
    const r = await op.atrasados(OP, 'b', envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '8' }] }));
    expect(r.status).toBe('APPLIED');
    const [, caminho, corpo] = legado.mock.calls[0];
    expect(caminho).toBe('/api/sessions/b/sorteio');
    expect(corpo.atribuicoes).toEqual([{ indice: 1, kart: '8', nome: 'Bia', customerId: '2' }]);
  });

  it('atrasado não pega kart ocupado nem quem já tem kart', async () => {
    expect((await op.atrasados(OP, 'b', envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '4' }] }))).erro).toMatch(/já está com Ana/);
    expect((await op.atrasados(OP, 'b', envio({ atribuicoes: [{ customerId: '1', nome: 'Ana', kart: '8' }] }))).erro).toMatch(/já tem/);
    expect(legado).not.toHaveBeenCalled();
  });

  it('kart fora de operação não entra no sorteio (T05)', async () => {
    await op.marcarKart(OP, '8', { reason: 'motor' });
    const r = await op.atrasados(OP, 'b', envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '8' }] }));
    expect(r.erro).toMatch(/fora de operação/);
    expect(store.db.prepare(`SELECT COUNT(*) n FROM auditoria WHERE action='fleet'`).get()).toMatchObject({ n: 1 });
  });

  it('bateria largada não aceita sorteio', async () => {
    bateria.state = 'em_andamento';
    const r = await op.sorteio(OP, 'b', envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '8' }] }));
    expect(r.status).toBe('REJECTED');
  });

  it('peso inválido é recusado e válido grava lastro (T13)', async () => {
    expect(() => op.peso(OP, 'b', envio({ customerId: '1', nome: 'Ana', pesoKg: 300 }))).toThrow(/20 e 250/);
    const r = await op.peso(OP, 'b', envio({ customerId: '1', nome: 'Ana', pesoKg: 72.5 }));
    expect(r.resultado).toMatchObject({ lastroKg: 17.5 });
    expect(legado.mock.calls[0][2].detalhes).toMatchObject({ peso: 72.5, pesoLastro: 17.5 });
  });

  it('troca de kart usa swap-kart e registra observação com autor', async () => {
    bateria.state = 'em_andamento';
    const r = await op.trocaKart(OP, 'b', envio({ fromKart: '4', toKart: '12', customerId: '1', nome: 'Ana', manterVoltas: false }));
    expect(r.status).toBe('APPLIED');
    expect(legado.mock.calls[0][1]).toBe('/api/sessions/b/swap-kart');
    expect(legado.mock.calls[0][2]).toMatchObject({ fromKart: '4', toKart: '12', manterVoltas: false });
    expect(legado.mock.calls[1][2].author).toBe('Op (app)');
  });

  it('troca com piloto em outro kart é recusada (T16)', async () => {
    bateria.state = 'em_andamento';
    const r = await op.trocaKart(OP, 'b', envio({ fromKart: '9', toKart: '12', customerId: '1', nome: 'Ana' }));
    expect(r.status).toBe('REJECTED');
    expect(legado).not.toHaveBeenCalled();
  });

  it('revisão antiga é recusada; passagem não importa (T35)', async () => {
    store.subirRevisao('b');
    await expect(op.penalidade(OP, 'b', envio({ kart: '4', tipo: 'tempo', segundos: 5 }))).rejects.toMatchObject({ codigo: 'REVISION_CONFLICT' });
  });

  it('mesmo id não duplica punição (T19)', async () => {
    const e = envio({ kart: '4', tipo: 'advertencia' });
    await op.penalidade(OP, 'b', e); await op.penalidade(OP, 'b', e);
    expect(legado).toHaveBeenCalledOnce();
  });

  it('sem resposta da cronometragem vira UNKNOWN e não repete (T20)', async () => {
    legado.mockRejectedValueOnce(Object.assign(new Error('timeout'), { desconhecido: true }));
    const e = envio({ kart: '4', tipo: 'advertencia' });
    expect((await op.penalidade(OP, 'b', e)).status).toBe('UNKNOWN');
    expect((await op.penalidade(OP, 'b', e)).status).toBe('UNKNOWN');
    expect(legado).toHaveBeenCalledOnce();
  });

  it('Recepção não executa nada (T22)', async () => {
    await expect(op.penalidade(REC, 'b', envio({ kart: '4', tipo: 'tempo' }))).rejects.toMatchObject({ http: 403 });
    await expect(op.trocaKart(REC, 'b', envio({ fromKart: '4', toKart: '5', customerId: '1', nome: 'Ana' }))).rejects.toMatchObject({ http: 403 });
    await expect(op.comando(REC, 'b', envio({ acao: 'start' }))).rejects.toMatchObject({ http: 403 });
    await expect(op.marcarKart(REC, '8', { reason: 'x' })).rejects.toMatchObject({ http: 403 });
    expect(legado).not.toHaveBeenCalled();
  });

  it('passagem: Recepção não corrige, motivo é obrigatório e usa a rota oficial', async () => {
    bateria.state = 'em_andamento';
    await expect(op.corrigirPassagem(REC, 'b', envio({ action: 'invalidate', ids: ['p1'] }))).rejects.toMatchObject({ http: 403 });
    expect(() => op.corrigirPassagem(OP, 'b', envio({ action: 'invalidate', ids: ['p1'] }, { reason: '' }))).toThrow(/motivo/);
    expect(() => op.corrigirPassagem(OP, 'b', envio({ action: 'apagar-tudo', ids: ['p1'] }))).toThrow(/inválida/);
    expect((await op.corrigirPassagem(OP, 'b', envio({ action: 'invalidate', ids: ['p1'] }))).status).toBe('APPLIED');
    expect(legado.mock.calls[0][1]).toBe('/api/sessions/b/passings/actions');
  });

  it('ao vivo e passagens não vazam cadastro', async () => {
    legado.mockResolvedValueOnce({ state: 'em_andamento', remainingMs: 1000, standings: [{ position: 1, kart: '4', name: 'Ana', laps: 3, bestLapMs: 58000, email: 'a@b.c', customerId: '1' }] });
    expect(JSON.stringify(await op.aoVivo('b'))).not.toMatch(/a@b|customerId/);
    legado.mockResolvedValueOnce([{ id: 'p', kart: '4', name: 'Ana', lapMs: 1, wallMs: 2, transponder: '999' }, { id: 'q', kart: '5' }]);
    const p = await op.passagens('b', '4');
    expect(p.passagens).toHaveLength(1);
    expect(JSON.stringify(p)).not.toContain('999');
  });

  it('comando crítico exige motivo', () => {
    expect(() => op.comando(OP, 'b', envio({ acao: 'restart' }, { reason: '' }))).toThrow(/motivo/);
  });

  it('painel mostra motivo de cada piloto e quem falta entrar', async () => {
    legado.mockResolvedValueOnce({ karts: ['4', '8', '120'], tipoKart: 'Light', pilotos: [
      { indice: 0, nome: 'Ana', customerId: '1', kartAtual: '4', excecoes: [], pesoKg: 70 },
      { indice: 2, nome: 'Cid', customerId: '3', kartAtual: '', excecoes: [], pesoKg: null },
    ] });
    insc.push({ clienteId: 7, nome: 'Dan', ...ok });
    const p = await op.painelSorteio('b');
    expect(p.pilotos[0]).toMatchObject({ situacao: 'ELEGIVEL', lastro: { lastroKg: 20 } });
    expect(p.pilotos[1]).toMatchObject({ situacao: 'INELEGIVEL', motivo: 'Pagamento pendente.' });
    expect(p.aguardandoEntrada).toEqual(['Dan']);
    expect(p.karts).toContainEqual({ kart: '4', frota: 'LIGHT', fora: false, ocupado: true });
  });
});
