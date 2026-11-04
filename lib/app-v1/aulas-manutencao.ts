import { randomUUID } from 'node:crypto';
import { pode, type Identidade } from './auth';
import { ErroApp, executar, type Pedido } from './comandos';
import type { AppStore } from './store';

/** Revisões próprias: aulas e manutenção não pertencem a nenhuma bateria. */
export const SESSAO_AULAS = 'aulas';
export const SESSAO_MANUTENCAO = 'manutencao';

export const INSTRUTORES = ['Anderson', 'Felisberto'] as const;
const FUSO = 'America/Sao_Paulo';
const MAX_VALOR_CENTAVOS = 100_000_000;
const MAX_QUANTIDADE = 1000;

export type StatusOrdem = 'aberta' | 'em_execucao' | 'concluida' | 'cancelada';
const TRANSICOES: Record<StatusOrdem, readonly StatusOrdem[]> = {
  aberta: ['em_execucao', 'cancelada'],
  em_execucao: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
};

type ReciboLinha = { id: string; instrutor: string; pilotos: number; aulas: number; valorCentavos: number; criadoEm: string; criadoPor: string; aceitoEm: string | null; aceitoPor: string | null };
type OrdemLinha = { id: string; kart: string; motivo: string; mecanico: string; status: StatusOrdem; criadaEm: string; criadaPor: string; atualizadaEm: string; atualizadaPor: string; observacao: string | null };

const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const inteiro = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);
const diaLocal = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: FUSO });
const invalido = (mensagem: string) => new ErroApp(400, 'INVALID_REQUEST', mensagem);

export type DepsAulasManutencao = { store: AppStore; routeMode?: string; agora?: () => Date };

export function criarAulasManutencao(d: DepsAulasManutencao) {
  const agora = () => (d.agora ?? (() => new Date()))();

  async function rodar(q: Identidade, capacidade: string, b: Record<string, unknown>, sessionId: string, command: string, fn: () => unknown) {
    const p: Pedido = {
      operationId: texto(b.operationId, 80), sessionId, command, reason: texto(b.reason) || undefined,
      expectedSessionRevision: Number(b.expectedSessionRevision), payload: b.payload ?? {},
    };
    if (!p.operationId || !Number.isInteger(p.expectedSessionRevision)) throw invalido('Pedido sem identificador ou revisão.');
    return executar({ store: d.store, identidade: q, routeMode: d.routeMode ?? 'internet', capacidade }, p, async () => fn());
  }

  const exige = (q: Identidade, capacidade: string) => { if (!pode(q.perfil, capacidade)) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão para esta ação.'); };
  const payload = (b: Record<string, unknown>) => (b.payload && typeof b.payload === 'object' ? b.payload as Record<string, unknown> : {});

  return {
    aulas(q: Identidade) {
      exige(q, 'sessoes.ver');
      const recibos = d.store.db.prepare('SELECT * FROM aulas_recibos ORDER BY criadoEm DESC LIMIT 200').all() as ReciboLinha[];
      const hoje = diaLocal(agora().toISOString());
      const resumoHoje = INSTRUTORES.map((instrutor) => {
        const doDia = recibos.filter((r) => r.instrutor === instrutor && diaLocal(r.criadoEm) === hoje);
        return { instrutor, pilotos: doDia.reduce((s, r) => s + r.pilotos, 0), aulas: doDia.reduce((s, r) => s + r.aulas, 0) };
      });
      return { recibos, resumoHoje, sessionRevision: d.store.revisao(SESSAO_AULAS) };
    },

    criarRecibo(q: Identidade, b: Record<string, unknown>) {
      const pl = payload(b);
      const instrutor = INSTRUTORES.find((i) => i === pl.instrutor);
      const pilotos = inteiro(pl.pilotos, 1, MAX_QUANTIDADE);
      const aulas = inteiro(pl.aulas, 1, MAX_QUANTIDADE);
      const valorCentavos = inteiro(pl.valorCentavos, 1, MAX_VALOR_CENTAVOS);
      if (!instrutor) throw invalido('Escolha o instrutor.');
      if (pilotos === null || aulas === null) throw invalido('Informe quantidade de pilotos e de aulas entre 1 e 1000.');
      if (valorCentavos === null) throw invalido('Informe um valor de recibo maior que zero.');
      return rodar(q, 'aulas.registrar', b, SESSAO_AULAS, 'lesson-create', () => {
        const id = randomUUID();
        d.store.transacao(() => {
          d.store.db.prepare('INSERT INTO aulas_recibos (id, instrutor, pilotos, aulas, valorCentavos, criadoEm, criadoPor) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, instrutor, pilotos, aulas, valorCentavos, agora().toISOString(), q.usuario);
          d.store.subirRevisao(SESSAO_AULAS);
        });
        return { id };
      });
    },

    aceitarRecibo(q: Identidade, id: string, b: Record<string, unknown>) {
      return rodar(q, 'aulas.aceitar', b, SESSAO_AULAS, 'lesson-accept', () => {
        const r = d.store.db.prepare('SELECT * FROM aulas_recibos WHERE id = ?').get(id) as ReciboLinha | undefined;
        if (!r) throw new Error('Recibo não encontrado.');
        if (r.aceitoEm) throw new Error(`Este recibo já foi aceito por ${r.aceitoPor}.`);
        d.store.transacao(() => {
          d.store.db.prepare('UPDATE aulas_recibos SET aceitoEm = ?, aceitoPor = ? WHERE id = ?').run(agora().toISOString(), q.usuario, id);
          d.store.subirRevisao(SESSAO_AULAS);
        });
        return { id };
      });
    },

    ordens(q: Identidade) {
      exige(q, 'manutencao.gerir');
      const ordens = d.store.db.prepare('SELECT * FROM ordens_servico ORDER BY criadaEm DESC LIMIT 300').all() as OrdemLinha[];
      return { ordens, sessionRevision: d.store.revisao(SESSAO_MANUTENCAO) };
    },

    criarOrdem(q: Identidade, b: Record<string, unknown>) {
      const pl = payload(b);
      const kart = texto(pl.kart, 4);
      const motivo = texto(pl.motivo);
      const mecanico = texto(pl.mecanico, 80);
      if (!/^\d{1,4}$/.test(kart)) throw invalido('Informe o número do kart.');
      if (!motivo) throw invalido('Descreva o defeito ou serviço.');
      if (!mecanico) throw invalido('Informe o mecânico responsável.');
      return rodar(q, 'manutencao.gerir', b, SESSAO_MANUTENCAO, 'maintenance-create', () => {
        if (!d.store.db.prepare('SELECT 1 FROM karts_fora WHERE kart = ?').get(kart)) throw new Error('O kart precisa estar na aba Oficina da frota.');
        if (d.store.db.prepare(`SELECT 1 FROM ordens_servico WHERE kart = ? AND status IN ('aberta','em_execucao')`).get(kart)) throw new Error(`O kart ${kart} já tem uma ordem em andamento.`);
        const id = randomUUID();
        const em = agora().toISOString();
        d.store.transacao(() => {
          d.store.db.prepare('INSERT INTO ordens_servico (id, kart, motivo, mecanico, status, criadaEm, criadaPor, atualizadaEm, atualizadaPor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, kart, motivo, mecanico, 'aberta', em, q.usuario, em, q.usuario);
          d.store.subirRevisao(SESSAO_MANUTENCAO);
        });
        return { id };
      });
    },

    mudarStatusOrdem(q: Identidade, id: string, b: Record<string, unknown>) {
      const novo = texto(payload(b).status) as StatusOrdem;
      if (!(novo in TRANSICOES)) throw invalido('Situação inválida.');
      return rodar(q, 'manutencao.gerir', b, SESSAO_MANUTENCAO, 'maintenance-status', () => {
        const o = d.store.db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(id) as OrdemLinha | undefined;
        if (!o) throw new Error('Ordem de serviço não encontrada.');
        if (!TRANSICOES[o.status].includes(novo)) throw new Error(`Uma ordem ${o.status.replace('_', ' ')} não pode ir para ${novo.replace('_', ' ')}.`);
        d.store.transacao(() => {
          d.store.db.prepare('UPDATE ordens_servico SET status = ?, atualizadaEm = ?, atualizadaPor = ? WHERE id = ?').run(novo, agora().toISOString(), q.usuario, id);
          d.store.subirRevisao(SESSAO_MANUTENCAO);
        });
        return { id, status: novo };
      });
    },
  };
}
