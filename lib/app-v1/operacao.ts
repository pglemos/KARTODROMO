import { randomUUID } from 'node:crypto';
import { pode, type Identidade } from './auth';
import { ErroApp, executar, type Pedido } from './comandos';
import { elegibilidade, frotaDoKart, pesoValido, planoLastro, type Inscricao } from './regras';
import type { AppStore } from './store';

/** Chama a mesma rota que o programa Windows usa: as regras de prova continuam num lugar só. */
export type Legado = (metodo: string, caminho: string, corpo?: unknown) => Promise<unknown>;
export class ErroLegado extends Error {}
export type DepsOperacao = {
  store: AppStore;
  legado: Legado;
  verSessao: (id: string) => unknown;
  inscricoes: (agendaId: number) => Promise<Inscricao[]>;
  routeMode?: string;
};

type Competidor = { kart: string; name: string; customerId?: string | null; category?: string | null; autoAdded?: boolean; detalhes?: Record<string, unknown>; penalidades?: unknown[] };
type Sessao = { id: string; name: string; state: string; agendaId?: number | null; competitors: Competidor[]; standings?: unknown };

const texto = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const real = (c: Competidor) => !c.autoAdded && c.name.trim() && c.name.trim().toLowerCase() !== `kart ${String(c.kart).toLowerCase()}`;
const chave = (c: { customerId?: unknown; name?: unknown; nome?: unknown }) => (c.customerId ? `c:${String(c.customerId)}` : `n:${String(c.name ?? c.nome ?? '').trim().toLowerCase()}`);

function exigeMotivo(b: Record<string, unknown>) {
  const m = texto(b.reason);
  if (!m) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o motivo.');
  return m;
}

export function criarOperacao(d: DepsOperacao) {
  const sessao = (id: string) => {
    const s = d.verSessao(id) as Sessao | undefined;
    if (!s) throw new ErroApp(404, 'NOT_FOUND', 'Bateria não encontrada.');
    return s;
  };
  const exigeEstado = (s: Sessao, ...ok: string[]) => {
    if (!ok.includes(s.state)) throw new ErroApp(409, 'STATE_CONFLICT', 'Esta ação não vale no estado atual da bateria.', { state: s.state });
  };
  const karts = () => new Set((d.store.db.prepare('SELECT kart FROM karts_fora').all() as { kart: string }[]).map((k) => k.kart));

  async function roda(q: Identidade, capacidade: string, b: Record<string, unknown>, sessionId: string, command: string, fn: () => Promise<unknown>) {
    const p: Pedido = {
      operationId: texto(b.operationId, 80), sessionId, command, reason: texto(b.reason) || undefined,
      expectedSessionRevision: Number(b.expectedSessionRevision), payload: b.payload ?? {},
    };
    if (!p.operationId || !Number.isInteger(p.expectedSessionRevision)) throw new ErroApp(400, 'INVALID_REQUEST', 'Pedido sem identificador ou revisão.');
    return executar({ store: d.store, identidade: q, routeMode: d.routeMode ?? 'internet', capacidade }, p, fn);
  }

  /** Situação de cada inscrito. Sem vínculo com a recepção valem as regras atuais; consulta que falha bloqueia. */
  async function situacoes(s: Sessao) {
    if (!s.agendaId) return { vinculada: false, mapa: new Map<string, ReturnType<typeof elegibilidade>>(), novos: [] as Inscricao[], consultaOk: true };
    try {
      const lista = await d.inscricoes(s.agendaId);
      const mapa = new Map(lista.map((i) => [chave({ customerId: i.clienteId, nome: i.nome }), elegibilidade(i)]));
      const presentes = new Set(s.competitors.map(chave));
      return { vinculada: true, mapa, novos: lista.filter((i) => !presentes.has(chave({ customerId: i.clienteId, nome: i.nome }))), consultaOk: true };
    } catch {
      return { vinculada: true, mapa: new Map<string, ReturnType<typeof elegibilidade>>(), novos: [] as Inscricao[], consultaOk: false };
    }
  }

  async function exigeElegiveis(s: Sessao, alvos: Competidor[]) {
    const sit = await situacoes(s);
    if (!sit.vinculada) return;
    for (const c of alvos) {
      const e = sit.consultaOk ? sit.mapa.get(chave(c)) ?? { situacao: 'INELEGIVEL', motivo: 'Saiu da agenda da recepção.' } : { situacao: 'INDETERMINADA', motivo: 'Recepção indisponível.' };
      if (e.situacao !== 'ELEGIVEL') throw new ErroApp(422, 'INELIGIBLE', `${c.name}: ${e.motivo}`);
    }
  }

  async function painelSorteio(id: string) {
    const s = sessao(id);
    const bruto = await d.legado('GET', `/api/sessions/${id}/sorteio`) as { karts: string[]; tipoKart: string | null; pilotos: { indice: number; nome: string; customerId: string | null; kartAtual: string; excecoes: string[]; pesoKg: number | null }[] };
    const sit = await situacoes(s);
    const fora = karts();
    const usados = new Set(s.competitors.filter(real).map((c) => c.kart).filter(Boolean));
    return {
      sessao: { id: s.id, name: s.name, state: s.state, sessionRevision: d.store.revisao(s.id), vinculadaRecepcao: sit.vinculada, recepcaoDisponivel: sit.consultaOk, tipoKart: bruto.tipoKart },
      pilotos: bruto.pilotos.map((p) => {
        const c = s.competitors[p.indice];
        const e = !sit.vinculada ? { situacao: 'SEM_VINCULO', motivo: null } : !sit.consultaOk ? { situacao: 'INDETERMINADA', motivo: 'Recepção indisponível.' } : sit.mapa.get(chave(c)) ?? { situacao: 'INELEGIVEL', motivo: 'Saiu da agenda da recepção.' };
        const frota = frotaDoKart(p.kartAtual);
        const peso = (c.detalhes?.peso as number | null | undefined) ?? p.pesoKg;
        return { ...p, pesoKg: peso ?? null, situacao: e.situacao, motivo: e.motivo, lastro: frota && pesoValido(peso) ? planoLastro(peso, frota) : null, lastroConferido: c.detalhes?.lastroConferido === true };
      }),
      aguardandoEntrada: sit.novos.filter((i) => elegibilidade(i).situacao === 'ELEGIVEL').map((i) => i.nome),
      karts: bruto.karts.map((kart) => ({ kart, frota: frotaDoKart(kart), fora: fora.has(kart), ocupado: usados.has(kart) })),
    };
  }

  /** Sorteio inicial e atrasados: quem não está na lista enviada não muda de kart. */
  async function gravarKarts(q: Identidade, id: string, b: Record<string, unknown>, parcial: boolean) {
    const s = sessao(id);
    const pl = (b.payload ?? {}) as { atribuicoes?: { customerId?: string | null; nome?: string; kart?: string }[]; modo?: string };
    const lista = Array.isArray(pl.atribuicoes) ? pl.atribuicoes : [];
    if (!lista.length) throw new ErroApp(400, 'INVALID_REQUEST', 'Nenhum piloto no sorteio.');
    return roda(q, parcial ? 'atrasado.incluir' : 'sorteio.gravar', b, id, parcial ? 'late-assignment' : 'draw', async () => {
      const atual = sessao(id);
      exigeEstado(atual, 'preparando');
      const fora = karts();
      const alvos: Competidor[] = [];
      const atrib = lista.map((a) => {
        const k = chave({ customerId: a.customerId, nome: a.nome });
        const indice = atual.competitors.findIndex((c) => chave(c) === k);
        if (indice < 0) throw new Error(`${a.nome ?? 'Piloto'} não está nesta bateria. Atualize a lista.`);
        const kart = texto(a.kart, 6);
        if (fora.has(kart)) throw new Error(`O kart ${kart} está fora de operação.`);
        const c = atual.competitors[indice];
        if (parcial && c.kart) throw new Error(`${c.name} já tem o kart ${c.kart}.`);
        const dono = atual.competitors.find((o, i) => i !== indice && o.kart === kart && real(o));
        if (dono && (parcial || !lista.some((x) => chave({ customerId: x.customerId, nome: x.nome }) === chave(dono)))) throw new Error(`O kart ${kart} já está com ${dono.name}.`);
        alvos.push(c);
        return { indice, kart, nome: c.name, customerId: c.customerId ?? null };
      });
      await exigeElegiveis(atual, alvos);
      await d.legado('POST', `/api/sessions/${id}/sorteio`, { atribuicoes: atrib, modo: pl.modo ?? (parcial ? 'fiscal' : 'todos') });
      return { gravados: atrib.length };
    });
  }

  const autor = (q: Identidade) => `${q.nome} (app)`;
  const FLAGS = new Set(['verde', 'amarela', 'vermelha', 'branca', 'quadriculada']);
  const FLAGS_PILOTO = new Set(['preta', 'verde', 'amarela', 'vermelha', 'branca', 'nenhuma']);

  return {
    async aoVivo(id: string) {
      sessao(id);
      const v = await d.legado('GET', `/api/sessions/${id}`) as { state?: string; remainingMs?: number | null; aguardandoLargada?: boolean; flag?: unknown; standings?: Record<string, unknown>[] };
      return {
        state: v.state, remainingMs: v.remainingMs ?? null, aguardandoLargada: Boolean(v.aguardandoLargada), flag: v.flag ?? null,
        standings: (v.standings ?? []).map((l) => ({ position: l.position, kart: l.kart, name: l.name, laps: l.laps, bestLapMs: l.bestLapMs, lastLapMs: l.lastLapMs ?? null, gap: l.gap ?? null, flag: l.flag ?? null })),
      };
    },
    async passagens(id: string, kart: string | null) {
      sessao(id);
      const rows = await d.legado('GET', `/api/sessions/${id}/passings`) as Record<string, unknown>[];
      return { passagens: (Array.isArray(rows) ? rows : []).filter((r) => !kart || r.kart === kart).slice(0, 300).map((r) => ({ id: r.id, kart: r.kart, name: r.name, voltas: r.voltas, lapMs: r.lapMs, wallMs: r.wallMs, invalid: r.invalid, deleted: r.deleted, rejected: r.rejected, reason: r.reason, source: r.source })) };
    },
    corrigirPassagem(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { action?: string; ids?: string[] };
      if (!['delete', 'restore', 'invalidate', 'validate'].includes(String(pl.action)) || !Array.isArray(pl.ids) || !pl.ids.length) throw new ErroApp(400, 'INVALID_REQUEST', 'Correção inválida.');
      exigeMotivo(b);
      return roda(q, 'passagem.corrigir', b, id, `passing-${pl.action}`, async () => {
        exigeEstado(sessao(id), 'em_andamento', 'bandeira_final', 'encerrada');
        const r = await d.legado('POST', `/api/sessions/${id}/passings/actions`, { action: pl.action, ids: pl.ids }) as { count?: number };
        await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Passagem corrigida (${pl.action}): ${texto(b.reason)}`, author: autor(q), kind: 'system' });
        return { count: r.count ?? 0 };
      });
    },
    equalizacoes: () => d.legado('GET', '/api/equalizacao').then((r) => ({ equalizacoes: (r as { equalizacoes?: unknown[] }).equalizacoes ?? [] })),
    equalizacao: (id: string) => d.legado('GET', `/api/equalizacao/${encodeURIComponent(id)}`),
    comandoEqualizacao(q: Identidade, id: string, b: Record<string, unknown>) {
      const acao = String((b.payload as { acao?: string } | undefined)?.acao);
      if (acao !== 'finalizar' && acao !== 'reabrir') throw new ErroApp(400, 'INVALID_REQUEST', 'Comando inválido.');
      exigeMotivo(b);
      return roda(q, 'equalizacao.gerir', b, id, `equalization-${acao}`, () => d.legado('POST', `/api/equalizacao/${encodeURIComponent(id)}/${acao}`, { autor: autor(q) }).then(() => ({ ok: true })));
    },
    async agenda(q: Identidade, data: string | null) {
      if (!pode(q.perfil, 'sessoes.ver')) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão.');
      return { baterias: await d.legado('GET', `/api/agenda${data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? `?data=${data}` : ''}`) };
    },
    painelSorteio,
    async detalhe(id: string) {
      const s = sessao(id);
      return { state: s.state, competitors: s.competitors.filter(real).map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, penalidades: c.penalidades ?? [] })), standings: s.standings ?? null };
    },
    frota() {
      return { fora: d.store.db.prepare('SELECT kart, motivo, usuario, em FROM karts_fora ORDER BY CAST(kart AS INTEGER)').all() };
    },
    async marcarKart(q: Identidade, kart: string, b: Record<string, unknown>) {
      if (!pode(q.perfil, 'frota.gerir')) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão.');
      if (b.fora === false) d.store.db.prepare('DELETE FROM karts_fora WHERE kart = ?').run(kart);
      else d.store.db.prepare('INSERT OR REPLACE INTO karts_fora (kart, motivo, usuario, em) VALUES (?, ?, ?, ?)').run(kart, exigeMotivo(b), q.usuario, new Date().toISOString());
      d.store.db.prepare(`INSERT INTO auditoria (auditId, actorUserId, actorRole, deviceId, timestampServerUTC, routeMode, action, reason, status, sourceSystem) VALUES (?, ?, ?, ?, ?, ?, 'fleet', ?, 'APPLIED', 'app-v1')`)
        .run(randomUUID(), q.usuarioId, q.perfil, q.deviceId, new Date().toISOString(), d.routeMode ?? 'internet', `kart ${kart}: ${b.fora === false ? 'voltou' : texto(b.reason)}`);
      return this.frota();
    },
    preparar: (q: Identidade, agendaId: number, b: Record<string, unknown>) => roda(q, 'bateria.preparar', b, `agenda-${agendaId}`, 'prepare', () => d.legado('POST', `/api/agenda/${agendaId}/preparar`, { nome: texto(b.nome, 80) })),
    sorteio: (q: Identidade, id: string, b: Record<string, unknown>) => gravarKarts(q, id, b, false),
    atrasados: (q: Identidade, id: string, b: Record<string, unknown>) => gravarKarts(q, id, b, true),
    peso(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { customerId?: string | null; nome?: string; pesoKg?: number; lastroConferido?: boolean };
      if (!pesoValido(pl.pesoKg)) throw new ErroApp(400, 'INVALID_REQUEST', 'Digite um peso entre 20 e 250 kg.');
      return roda(q, 'peso.conferir', b, id, 'weight-check', async () => {
        const s = sessao(id);
        exigeEstado(s, 'preparando', 'em_andamento');
        const indice = s.competitors.findIndex((c) => chave(c) === chave({ customerId: pl.customerId, nome: pl.nome }));
        if (indice < 0) throw new Error('Piloto não está nesta bateria.');
        const c = s.competitors[indice];
        const frota = frotaDoKart(c.kart);
        const plano = frota ? planoLastro(pl.pesoKg as number, frota) : null;
        await d.legado('PUT', `/api/sessions/${id}/competitors/${indice}`, {
          kartAntes: c.kart, nomeAntes: c.name, kart: c.kart, name: c.name,
          detalhes: { ...c.detalhes, peso: pl.pesoKg, pesoLastro: plano?.lastroKg ?? null, lastroConferido: pl.lastroConferido === true },
        });
        return plano;
      });
    },
    trocaKart(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { fromKart?: string; toKart?: string; customerId?: string | null; nome?: string; manterVoltas?: boolean };
      const para = texto(pl.toKart, 6);
      if (!para || !pl.fromKart) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o kart atual e o novo.');
      exigeMotivo(b);
      return roda(q, 'kart.trocar', b, id, 'kart-swap', async () => {
        const s = sessao(id);
        exigeEstado(s, 'preparando', 'em_andamento', 'bandeira_final');
        if (karts().has(para)) throw new Error(`O kart ${para} está fora de operação.`);
        const c = s.competitors.find((x) => x.kart === pl.fromKart && chave(x) === chave({ customerId: pl.customerId, nome: pl.nome }));
        if (!c) throw new ErroApp(409, 'STALE_ASSIGNMENT', 'O piloto não está mais nesse kart. Atualize.');
        const r = await d.legado('POST', `/api/sessions/${id}/swap-kart`, { fromKart: pl.fromKart, toKart: para, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes ?? {}, manterVoltas: pl.manterVoltas !== false });
        await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Troca de kart · ${c.name} do kart ${pl.fromKart} para o ${para}${pl.manterVoltas === false ? ` (voltas e tempos do kart ${pl.fromKart} desconsiderados)` : ''}`, author: autor(q), kind: 'kart-swap' });
        return { troca: (r as { troca?: unknown })?.troca ?? null };
      });
    },
    penalidade(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { kart?: string; tipo?: string; segundos?: number; motivo?: string; kartAtingido?: string; curva?: string; volta?: number };
      if (!pl.kart || !['tempo', 'advertencia'].includes(String(pl.tipo))) throw new ErroApp(400, 'INVALID_REQUEST', 'Penalidade inválida.');
      return roda(q, 'penalidade.aplicar', b, id, 'penalty', () => d.legado('POST', `/api/sessions/${id}/penalties/${encodeURIComponent(pl.kart as string)}`, { ...pl, autor: autor(q) }).then(() => ({ ok: true })));
    },
    retirarPenalidade(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { kart?: string; penalidadeId?: string };
      if (!pl.kart || !pl.penalidadeId) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe a penalidade.');
      exigeMotivo(b);
      return roda(q, 'penalidade.aplicar', b, id, 'penalty-remove', () => d.legado('DELETE', `/api/sessions/${id}/penalties/${encodeURIComponent(pl.kart as string)}/${encodeURIComponent(pl.penalidadeId as string)}`).then(() => ({ ok: true })));
    },
    bandeira(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { flag?: string; kart?: string; relargar?: boolean; motivo?: string };
      const flag = String(pl.flag);
      if (pl.kart ? !FLAGS_PILOTO.has(flag) : !FLAGS.has(flag)) throw new ErroApp(400, 'INVALID_REQUEST', 'Bandeira inválida.');
      if (pl.relargar || flag === 'preta') exigeMotivo(b);
      const cap = pl.relargar ? 'prova.reiniciar' : 'bandeira.aplicar';
      return roda(q, cap, b, id, pl.relargar ? 'relargada' : 'flag', () => d.legado('POST', pl.kart ? `/api/sessions/${id}/flag/${encodeURIComponent(pl.kart)}` : `/api/sessions/${id}/flag`, { flag, relargar: pl.relargar === true, motivo: pl.motivo, autor: autor(q) }).then(() => ({ ok: true })));
    },
    comando(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { acao?: string };
      const acoes: Record<string, { rota: string; cap: string; critico: boolean }> = {
        start: { rota: 'start', cap: 'prova.comandar', critico: true }, checkered: { rota: 'checkered', cap: 'prova.comandar', critico: true },
        close: { rota: 'close', cap: 'prova.comandar', critico: true }, cancel: { rota: 'cancel', cap: 'prova.reiniciar', critico: true }, restart: { rota: 'restart', cap: 'prova.reiniciar', critico: true },
      };
      const a = acoes[String(pl.acao)];
      if (!a) throw new ErroApp(400, 'INVALID_REQUEST', 'Comando inválido.');
      if (a.critico) exigeMotivo(b);
      return roda(q, a.cap, b, id, `command-${pl.acao}`, () => d.legado('POST', `/api/sessions/${id}/${a.rota}`, { autor: autor(q) }).then(() => ({ ok: true })));
    },
  };
}
