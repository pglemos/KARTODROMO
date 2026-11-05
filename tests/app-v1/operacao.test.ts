import { diaAbertura } from '../../lib/app-v1/abertura-frota';
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
    for (const kart of ['4', '8', '9', '12', '120']) store.db.prepare('INSERT INTO abertura_frota VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(diaAbertura(), kart, '[]', 'TESTE CODEX', new Date().toISOString(), 'TESTE CODEX', new Date().toISOString(), 'Fixture: frota previamente liberada');
    legado = vi.fn(async () => ({}));
    bateria = { id: 'b', name: 'B', state: 'preparando', agendaId: 9, competitors: [
      { kart: '4', name: 'Ana', customerId: '1' }, { kart: '', name: 'Bia', customerId: '2' }, { kart: '', name: 'Cid', customerId: '3' },
    ] };
    insc = [{ clienteId: 1, nome: 'Ana', ...ok }, { clienteId: 2, nome: 'Bia', ...ok }, { clienteId: 3, nome: 'Cid', ...ok, pago: false }];
    op = criarOperacao({ store, legado: legado as never, verSessao: (id) => (id === 'b' ? bateria : undefined), inscricoes: async () => insc });
  });

  it('sorteio e troca recusam kart sem aceite diário mesmo com pedido adulterado', async () => {
    store.db.prepare('DELETE FROM abertura_frota WHERE kart = ?').run('8');
    expect((await op.atrasados(OP, 'b', envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '8' }] }))).status).toBe('REJECTED');
    expect((await op.trocaKart(OP, 'b', envio({ fromKart: '4', toKart: '8', customerId: '1', nome: 'Ana' }))).status).toBe('REJECTED');
    expect(legado).not.toHaveBeenCalled();
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
    legado.mockResolvedValueOnce({ count: 1 });
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

  it('bandeira preta usa o valor que a cronometragem aceita', async () => {
    await op.bandeira(OP, 'b', envio({ flag: 'black', kart: '4', motivo: 'x' }));
    expect(legado.mock.calls[0][1]).toBe('/api/sessions/b/flag/4');
    expect(legado.mock.calls[0][2].flag).toBe('black');
    expect(() => op.bandeira(OP, 'b', envio({ flag: 'preta', kart: '4' }))).toThrow(/inválida/);
  });

  it('conferência de lastro persiste no app e volta no painel; troca de kart zera', async () => {
    await op.peso(OP, 'b', envio({ customerId: '1', nome: 'Ana', pesoKg: 70, lastroConferido: true }));
    expect(legado.mock.calls[0][2]).toMatchObject({ aplicarGrupo: true });
    const bruto = { karts: [], tipoKart: null, pilotos: [{ indice: 0, nome: 'Ana', customerId: '1', kartAtual: '4', excecoes: [], pesoKg: 70 }] };
    legado.mockResolvedValueOnce(bruto);
    expect((await op.painelSorteio(OP, 'b')).pilotos[0].lastroConferido).toBe(true);
    // Outra etapa da mesma bateria (ex.: Corrida quando o lastro foi conferido na Tomada de tempo) herda a conferência no mesmo kart
    const corrida = { ...bateria, id: 'b-corrida' };
    const opDuasEtapas = criarOperacao({ store, legado: legado as never, verSessao: (id) => (id === 'b-corrida' ? corrida : bateria), inscricoes: async () => insc });
    legado.mockResolvedValueOnce({ ...bruto, programa: [{ id: 'b' }] });
    expect((await opDuasEtapas.painelSorteio(OP, 'b-corrida')).pilotos[0].lastroConferido).toBe(true);
    bateria.competitors[0].kart = '9';
    legado.mockResolvedValueOnce({ ...bruto, pilotos: [{ ...bruto.pilotos[0], kartAtual: '9' }] });
    expect((await op.painelSorteio(OP, 'b')).pilotos[0].lastroConferido).toBe(false);
  });

  it('Recepção não recebe peso', async () => {
    legado.mockResolvedValueOnce({ karts: [], tipoKart: null, pilotos: [{ indice: 0, nome: 'Ana', customerId: '1', kartAtual: '4', excecoes: [], pesoKg: 70 }] });
    expect((await op.painelSorteio(REC, 'b')).pilotos[0]).toMatchObject({ pesoKg: null, customerId: null, lastro: null });
  });

  it('piloto sem id casa pelo nome', async () => {
    bateria.competitors[1].customerId = null;
    const r = await op.atrasados(OP, 'b', envio({ atribuicoes: [{ customerId: null, nome: 'Bia', kart: '8' }] }));
    expect(r.status).toBe('APPLIED');
  });

  it('comando fora do estado não chega à cronometragem', async () => {
    bateria.state = 'encerrada';
    const r = await op.comando(OP, 'b', envio({ acao: 'cancel' }));
    expect(r.status).toBe('REJECTED');
    expect(legado).not.toHaveBeenCalled();
  });

  it('correção sem efeito não diz que corrigiu', async () => {
    bateria.state = 'em_andamento';
    legado.mockResolvedValueOnce({ count: 0 });
    expect((await op.corrigirPassagem(OP, 'b', envio({ action: 'invalidate', ids: ['p1'] }))).status).toBe('REJECTED');
  });

  it('checklist da oficina preserva o que já estava gravado', async () => {
    legado.mockResolvedValueOnce({ finalizadaEm: null });
    legado.mockResolvedValueOnce({ resultado: { karts: [{ kart: '4', checklist: { sistemas: { motor: { status: 'atencao' } }, observacoes: 'obs', acaoOficina: 'antiga' } }] } });
    const r = await op.comandoEqualizacao({ ...OP, perfil: 'EQUALIZACAO' }, 'eq', envio({ acao: 'checklist', kart: '4', acaoOficina: 'nova' }));
    expect(r.status).toBe('APPLIED');
    const [m, c, corpo] = legado.mock.calls[2];
    expect([m, c]).toEqual(['PUT', '/api/equalizacao/eq/karts/4']);
    expect(corpo).toMatchObject({ acaoOficina: 'nova', observacoes: 'obs', sistemas: { motor: { status: 'atencao' } } });
    expect(corpo).not.toHaveProperty('confirmacaoManual');
  });

  it('redutor e abertura usam as rotas da cronometragem; Recepção não mexe', async () => {
    await op.comandoEqualizacao({ ...OP, perfil: 'EQUALIZACAO' }, 'eq', envio({ acao: 'abertura', kart: '4', bloco: 2, mm: '0,3' }));
    expect(legado.mock.calls[1]).toEqual(['PATCH', '/api/equalizacao/eq', { abertura: { kart: '4', bloco: 2, mm: '0,3' } }]);
    await expect(op.comandoEqualizacao(REC, 'eq', envio({ acao: 'redutor', kart: '4', mm: '17' }))).rejects.toMatchObject({ http: 403 });
    expect(() => op.comandoEqualizacao({ ...OP, perfil: 'EQUALIZACAO' }, 'eq', envio({ acao: 'apagar' }))).toThrow(/inválido/);
  });

  it('equalização finalizada não aceita alteração, só reabrir', async () => {
    legado.mockResolvedValueOnce({ finalizadaEm: 123 });
    const r = await op.comandoEqualizacao({ ...OP, perfil: 'EQUALIZACAO' }, 'eq', envio({ acao: 'config', mecanico: 'Zé' }));
    expect(r.status).toBe('REJECTED');
    expect(legado.mock.calls.some(([m]) => m === 'PATCH')).toBe(false);
  });

  it('importação devolve os karts que não vieram', async () => {
    legado.mockResolvedValueOnce({ finalizadaEm: null });
    legado.mockResolvedValueOnce({ importados: ['4'], ignorados: ['9'] });
    const r = await op.comandoEqualizacao({ ...OP, perfil: 'EQUALIZACAO' }, 'eq', envio({ acao: 'importar', sessionId: 'b', karts: ['4', '9'] }));
    expect(r.resultado).toEqual({ importados: ['4'], ignorados: ['9'] });
  });

  it.each([['quebra', 'oficina'], ['desempenho', 'equalizar']])('troca por %s bloqueia o kart antigo antes de liberar o substituto', async (tipoTroca, estado) => {
    const r = await op.trocaKart(OP, 'b', envio({ fromKart: '4', toKart: '8', customerId: '1', tipoTroca }));
    expect(r.status).toBe('APPLIED');
    expect(store.db.prepare('SELECT estado, usuario FROM karts_fora WHERE kart = ?').get('4')).toMatchObject({ estado, usuario: 'op' });
  });

  it('números do dia ignoram outros dias e cancelada', () => {
    const agora = new Date('2026-11-01T15:00:00Z');
    const hoje = agora.getTime(); const ontem = hoje - 2 * 86_400_000;
    store.db.prepare(`INSERT INTO auditoria (auditId, action, status, timestampServerUTC) VALUES ('a', 'penalty', 'APPLIED', ?)`).run(agora.toISOString());
    const r = op.resumoDoDia([
      { id: '1', state: 'encerrada', createdAt: hoje, competitors: [{ kart: '4', name: 'Ana' }, { kart: '5', name: 'Kart 5', autoAdded: true }] },
      { id: '2', state: 'em_andamento', createdAt: hoje, competitors: [{ kart: '6', name: 'Bia' }] },
      { id: '3', state: 'cancelada', createdAt: hoje, competitors: [] },
      { id: '4', state: 'encerrada', createdAt: ontem, competitors: [{ kart: '7', name: 'Cid' }] },
    ], agora);
    expect(r.baterias).toMatchObject({ total: 2, emProva: 1, encerradas: 1 });
    expect(r.pilotos).toBe(2);
    expect(r.ultimas24h.punicoes).toBe(1);
    expect(r.ultimas24h.origem).toBe('app-v1');
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
    const p = await op.painelSorteio(OP, 'b');
    expect(p.pilotos[0]).toMatchObject({ situacao: 'ELEGIVEL', lastro: { lastroKg: 20 } });
    expect(p.pilotos[1]).toMatchObject({ situacao: 'INELEGIVEL', motivo: 'Pagamento pendente.' });
    expect(p.aguardandoEntrada).toEqual(['Dan']);
    expect(p.karts).toContainEqual({ kart: '4', frota: 'LIGHT', fora: false, ocupado: true });
  });

  it('fluxo completo de bateria única (Tomada de tempo + Corrida): sorteio único, atrasado, lastro compartilhado, troca de kart, direção e equalização completa', async () => {
    const tomada: any = {
      id: '2026-11-01-tomada', name: 'BATERIA 18:00 · TOMADA DE TEMPO', type: 'classificacao', state: 'preparando',
      agendaId: 101, programaId: 'agenda-101', groupId: 'grp-1800', createdAt: Date.now(),
      competitors: [
        { kart: '', name: 'Ana', customerId: '1', detalhes: {} },
        { kart: '', name: 'Bia', customerId: '2', detalhes: {} },
      ],
    };
    const corrida: any = {
      id: '2026-11-01-corrida', name: 'BATERIA 18:00 · CORRIDA', type: 'corrida', state: 'preparando',
      agendaId: 101, programaId: 'agenda-101', groupId: 'grp-1800', createdAt: Date.now(),
      competitors: [
        { kart: '', name: 'Ana', customerId: '1', detalhes: {} },
        { kart: '', name: 'Bia', customerId: '2', detalhes: {} },
      ],
    };
    const sessoes = new Map<string, any>([[tomada.id, tomada], [corrida.id, corrida]]);
    const legadoSim = vi.fn(async (metodo: string, caminho: string, corpo?: any) => {
      const mSorteio = /^\/api\/sessions\/([\w-]+)\/sorteio$/.exec(caminho);
      if (mSorteio && metodo === 'GET') {
        const s = sessoes.get(mSorteio[1]);
        const irmas = [...sessoes.values()].filter((x) => x.id !== s.id && x.agendaId === s.agendaId);
        return {
          sessao: { id: s.id, name: s.name, type: s.type, state: s.state },
          programa: irmas.map((x) => ({ id: x.id, name: x.name, state: x.state })),
          tipoKart: 'Light',
          karts: ['4', '8', '12'],
          pilotos: s.competitors.map((c: any, indice: number) => ({
            indice, nome: c.name, customerId: c.customerId, kartAtual: c.kart, excecoes: [], pesoKg: c.detalhes?.peso ?? null,
          })),
        };
      }
      if (mSorteio && metodo === 'POST') {
        const s = sessoes.get(mSorteio[1]);
        for (const a of corpo.atribuicoes) s.competitors[a.indice].kart = a.kart;
        for (const irma of sessoes.values()) {
          if (irma.id !== s.id && irma.agendaId === s.agendaId && irma.state === 'preparando') {
            irma.competitors = s.competitors.map((c: any) => ({ ...c, detalhes: { ...c.detalhes } }));
          }
        }
        return { ok: true };
      }
      const mComp = /^\/api\/sessions\/([\w-]+)\/competitors\/(\d+)$/.exec(caminho);
      if (mComp && metodo === 'PUT') {
        const s = sessoes.get(mComp[1]);
        const idx = Number(mComp[2]);
        s.competitors[idx] = { ...s.competitors[idx], kart: corpo.kart, name: corpo.name, detalhes: corpo.detalhes };
        if (corpo.aplicarGrupo) {
          for (const irma of sessoes.values()) {
            if (irma.id !== s.id && irma.agendaId === s.agendaId) {
              const k = irma.competitors.findIndex((c: any) => c.customerId === s.competitors[idx].customerId);
              if (k >= 0) irma.competitors[k] = { ...irma.competitors[k], detalhes: corpo.detalhes };
            }
          }
        }
        return { ok: true };
      }
      const mCmd = /^\/api\/sessions\/([\w-]+)\/(start|checkered|close)$/.exec(caminho);
      if (mCmd && metodo === 'POST') {
        const s = sessoes.get(mCmd[1]);
        s.state = mCmd[2] === 'start' ? 'em_andamento' : mCmd[2] === 'checkered' ? 'bandeira_final' : 'encerrada';
        return { ok: true };
      }
      return { ok: true };
    });

    const opBateria = criarOperacao({
      store,
      legado: legadoSim as never,
      verSessao: (id) => sessoes.get(id),
      inscricoes: async () => [{ clienteId: 1, nome: 'Ana', ...ok }, { clienteId: 2, nome: 'Bia', ...ok }],
    });

    // 1. Sorteio inicial na Tomada de tempo (só Ana)
    const rSorteio = await opBateria.sorteio(OP, tomada.id, envio({ atribuicoes: [{ customerId: '1', nome: 'Ana', kart: '4' }], modo: 'todos' }));
    expect(rSorteio.status).toBe('APPLIED');
    expect(tomada.competitors[0].kart).toBe('4');
    expect(corrida.competitors[0].kart).toBe('4');

    // 2. Atrasado (Bia) entra sem alterar o kart de Ana e propaga para a Corrida
    const rAtrasado = await opBateria.atrasados(OP, tomada.id, envio({ atribuicoes: [{ customerId: '2', nome: 'Bia', kart: '8' }] }));
    expect(rAtrasado.status).toBe('APPLIED');
    expect(tomada.competitors[1].kart).toBe('8');
    expect(corrida.competitors[1].kart).toBe('8');

    // 3. Peso e conferência de lastro na Tomada de tempo valem também na Corrida
    const rPeso = await opBateria.peso(OP, tomada.id, envio({ customerId: '1', nome: 'Ana', pesoKg: 70, lastroConferido: true }));
    expect(rPeso.status).toBe('APPLIED');
    expect(corrida.competitors[0].detalhes).toMatchObject({ peso: 70, pesoLastro: 20 });

    // 4. Tomada de tempo larga, recebe quadriculada e encerra
    expect((await opBateria.comando(OP, tomada.id, envio({ acao: 'start' }))).status).toBe('APPLIED');
    expect((await opBateria.comando(OP, tomada.id, envio({ acao: 'checkered' }))).status).toBe('APPLIED');
    expect((await opBateria.comando(OP, tomada.id, envio({ acao: 'close' }))).status).toBe('APPLIED');
    expect(tomada.state).toBe('encerrada');

    // 5. Na Corrida (ainda preparando), o painel traz os karts sorteados na tomada, o peso e o lastro já conferido
    const painelCorrida = await opBateria.painelSorteio(OP, corrida.id);
    expect(painelCorrida.pilotos[0]).toMatchObject({ nome: 'Ana', kartAtual: '4', pesoKg: 70, lastroConferido: true, situacao: 'ELEGIVEL' });
    expect(painelCorrida.pilotos[1]).toMatchObject({ nome: 'Bia', kartAtual: '8', situacao: 'ELEGIVEL' });
  });

  it('permite limpar kart no sorteio antes da largada, atribuir/incluir passagem, observação/posição e resumo com frota/bateria ativa', async () => {
    // Limpar kart de Ana antes da largada via PATCH /api/sessions/b
    const rLimpar = await op.sorteio(OP, 'b', envio({ atribuicoes: [{ customerId: '1', nome: 'Ana', kart: '' }] }));
    expect(rLimpar.status).toBe('APPLIED');
    expect(legado.mock.calls[0]).toEqual(['PATCH', '/api/sessions/b', {
      competitors: [
        { kart: '', name: 'Ana', customerId: '1', category: null, detalhes: undefined },
        { kart: '', name: 'Bia', customerId: '2', category: null, detalhes: undefined },
        { kart: '', name: 'Cid', customerId: '3', category: null, detalhes: undefined },
      ],
    }]);

    // Em andamento: incluir passagem manual, atribuir passagem, observação e posição manual
    bateria.state = 'em_andamento';
    expect((await op.corrigirPassagem(OP, 'b', envio({ action: 'manual', kart: '4', lapMs: 58412, name: 'Ana' }))).status).toBe('APPLIED');
    expect(legado.mock.calls.some(([m, c]) => m === 'POST' && c === '/api/sessions/b/passings/manual')).toBe(true);

    expect((await op.corrigirPassagem(OP, 'b', envio({ action: 'assign', ids: ['p1'], kart: '4', name: 'Ana' }))).status).toBe('APPLIED');
    expect(legado.mock.calls.some(([m, c]) => m === 'POST' && c === '/api/sessions/b/passings/p1/assign')).toBe(true);

    expect((await op.comando(OP, 'b', envio({ acao: 'observation', texto: 'Toque na curva 2' }))).status).toBe('APPLIED');
    expect((await op.comando(OP, 'b', envio({ acao: 'position', kart: '4', position: 1 }))).status).toBe('APPLIED');

    // Frota com naPista e cadastrados
    const opFrota = criarOperacao({
      store, legado: legado as never, verSessao: () => bateria, inscricoes: async () => insc,
      kartsCadastrados: () => ['1', '4', '8', '105'],
      listarSessoes: () => [bateria],
    });
    const f = opFrota.frota();
    expect(f.cadastrados).toEqual(['1', '4', '8', '105']);
    expect(f.naPista).toEqual([{ kart: '4', sessaoId: 'b', bateria: 'B', piloto: 'Ana', estado: 'em_andamento' }]);
  });
});
