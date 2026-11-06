import { chassisFrota, gravarChassi } from './chassi';
import { indicadoresDia } from './indicadores-dia';
import { tempoGalpao } from './tempo-galpao';
import { criarAberturaFrota, kartLiberadoHoje } from './abertura-frota';
import { compararHistorico } from '../timing/equalizacao';
import { INFRACOES, alertasPerigosos } from '../timing/race-engine';
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
  kartsCadastrados?: () => string[];
  listarSessoes?: () => unknown[];
  sessoesHistoricas?: () => unknown[];
  routeMode?: string;
};

type Competidor = { kart: string; name: string; customerId?: string | null; category?: string | null; autoAdded?: boolean; detalhes?: Record<string, unknown>; penalidades?: unknown[]; flag?: string | null };
type Sessao = { id: string; name: string; state: string; type?: string; agendaId?: number | null; competitors: Competidor[]; standings?: unknown; observations?: unknown[]; currentFlag?: string | null; remainingMs?: number | null };
type FrotaSnapshot = { fora: { kart: string; motivo: string; usuario: string; em: string; estado: string }[]; naPista: { kart: string; sessaoId: string; bateria: string; piloto: string; estado: string }[]; cadastrados: string[]; semTeste: { kart: string; sessionId: string; autor: string; em: string; ajusteMm: number | null }[]; sessionRevision: number };
type RespostaOperacao = Awaited<ReturnType<typeof executar>>;

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
  const abertura = criarAberturaFrota({ ...d, kartsCadastrados: d.kartsCadastrados ?? (() => []) });
  const karts = () => new Set((d.store.db.prepare('SELECT kart FROM karts_fora').all() as { kart: string }[]).map((k) => k.kart));

  function atualizarConclusaoGalpao(s: Sessao) {
    if (!s.agendaId) return;
    const ids = [...new Set([s.id, ...((d.listarSessoes?.() ?? []) as Sessao[]).filter(x => x.agendaId === s.agendaId).map(x => x.id)])];
    const conferidos = new Map((d.store.db.prepare(`SELECT chave, kart FROM lastros_conferidos WHERE sessionId IN (${ids.map(() => '?').join(',')}) ORDER BY em ASC`).all(...ids) as { chave: string; kart: string }[]).map(x => [x.chave, x.kart]));
    const pilotos = s.competitors.filter(real);
    const esperado = (d.store.db.prepare('SELECT quantidadeKarts FROM tempos_galpao WHERE bateria = ?').get(`agenda-${s.agendaId}`) as { quantidadeKarts: number } | undefined)?.quantidadeKarts ?? pilotos.length;
    tempoGalpao(d.store, `agenda-${s.agendaId}`, {
      atualizar: true, podeIniciar: false, todosAptos: true,
      concluido: pilotos.length > 0 && pilotos.length >= esperado && pilotos.every(c => c.kart && conferidos.get(chave(c)) === c.kart), quantidade: Math.max(pilotos.length, esperado),
    });
  }

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
    if (!s.agendaId) return { vinculada: false, mapa: new Map<string, ReturnType<typeof elegibilidade>>(), novos: [] as Inscricao[], consultaOk: true, todosAptos: false };
    try {
      const lista = await d.inscricoes(s.agendaId);
      // casa por cliente e também por nome: piloto digitado na cronometragem pode não ter o id
      const mapa = new Map(lista.flatMap((i) => [[chave({ customerId: i.clienteId }), elegibilidade(i)], [chave({ nome: i.nome }), elegibilidade(i)]] as [string, ReturnType<typeof elegibilidade>][]));
      const presentes = new Set(s.competitors.flatMap((c) => [chave(c), chave({ nome: c.name })]));
      return { vinculada: true, mapa, novos: lista.filter((i) => !presentes.has(chave({ customerId: i.clienteId })) && !presentes.has(chave({ nome: i.nome }))), consultaOk: true, todosAptos: lista.length > 0 && lista.every(i => elegibilidade(i).situacao === 'ELEGIVEL') };
    } catch {
      return { vinculada: true, mapa: new Map<string, ReturnType<typeof elegibilidade>>(), novos: [] as Inscricao[], consultaOk: false, todosAptos: false };
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
    const bruto = await d.legado('GET', `/api/sessions/${id}/sorteio`) as { programa?: { id: string }[]; karts: string[]; tipoKart: string | null; pilotos: { indice: number; nome: string; customerId: string | null; kartAtual: string; excecoes: string[]; pesoKg: number | null }[] };
    const sit = await situacoes(s);
    const fora = karts();
    const usados = new Set(s.competitors.filter(real).map((c) => c.kart).filter(Boolean));
    const idsPrograma = [...new Set([id, ...(bruto.programa ?? []).map((x) => x.id).filter(Boolean)])];
    const placeholders = idsPrograma.map(() => '?').join(',');
    const conferidos = new Map((d.store.db.prepare(`SELECT chave, kart FROM lastros_conferidos WHERE sessionId IN (${placeholders}) ORDER BY em ASC`).all(...idsPrograma) as { chave: string; kart: string }[]).map((l) => [l.chave, l.kart]));
    const painel = {
      sessao: { id: s.id, name: s.name, state: s.state, sessionRevision: d.store.revisao(s.id), vinculadaRecepcao: sit.vinculada, recepcaoDisponivel: sit.consultaOk, tipoKart: bruto.tipoKart },
      pilotos: bruto.pilotos.map((p) => {
        const c = s.competitors[p.indice];
        const e = !sit.vinculada ? { situacao: 'SEM_VINCULO', motivo: null } : !sit.consultaOk ? { situacao: 'INDETERMINADA', motivo: 'Recepção indisponível.' } : sit.mapa.get(chave(c)) ?? { situacao: 'INELEGIVEL', motivo: 'Saiu da agenda da recepção.' };
        const frota = frotaDoKart(p.kartAtual);
        const peso = (c.detalhes?.peso as number | null | undefined) ?? p.pesoKg;
        return { ...p, pesoKg: peso ?? null, situacao: e.situacao, motivo: e.motivo, lastro: frota && pesoValido(peso) ? planoLastro(peso, frota) : null, lastroConferido: conferidos.get(chave(c)) === c.kart };
      }),
      aguardandoEntrada: sit.novos.filter((i) => elegibilidade(i).situacao === 'ELEGIVEL').map((i) => i.nome),
      karts: bruto.karts.map((kart) => ({ kart, frota: frotaDoKart(kart), fora: fora.has(kart) || !kartLiberadoHoje(d.store, kart), ocupado: usados.has(kart) })),
    };
    const reais = s.competitors.filter(real);
    const todosAptos = sit.todosAptos && reais.every(c => sit.mapa.get(chave(c))?.situacao === 'ELEGIVEL');
    const processoGalpao = s.agendaId ? tempoGalpao(d.store, `agenda-${s.agendaId}`, {
      atualizar: ['preparando', 'em_andamento', 'bandeira_final'].includes(s.state) && sit.consultaOk,
      podeIniciar: s.state === 'preparando',
      todosAptos,
      concluido: sit.novos.length === 0 && reais.length > 0 && reais.every(c => c.kart && conferidos.get(chave(c)) === c.kart),
      quantidade: reais.length + sit.novos.length,
    }) : null;
    return { ...painel, processoGalpao };

  }

  /** Sorteio inicial, reajuste e atrasados: quem não está na lista enviada não muda de kart. */
  async function gravarKarts(q: Identidade, id: string, b: Record<string, unknown>, parcial: boolean) {
    sessao(id);
    const pl = (b.payload ?? {}) as { atribuicoes?: { customerId?: string | null; nome?: string; kart?: string }[]; modo?: string };
    const lista = Array.isArray(pl.atribuicoes) ? pl.atribuicoes : [];
    if (!lista.length) throw new ErroApp(400, 'INVALID_REQUEST', 'Nenhum piloto no sorteio.');
    return roda(q, parcial ? 'atrasado.incluir' : 'sorteio.gravar', b, id, parcial ? 'late-assignment' : 'draw', async () => {
      const atual = sessao(id);
      exigeEstado(atual, 'preparando');
      const fora = karts();
      const alvos: Competidor[] = [];
      let temLimpeza = false;
      const atrib = lista.map((a) => {
        const k = chave({ customerId: a.customerId, nome: a.nome });
        const indice = atual.competitors.findIndex((c) => chave(c) === k);
        if (indice < 0) throw new Error(`${a.nome ?? 'Piloto'} não está nesta bateria. Atualize a lista.`);
        const kart = texto(a.kart, 6);
        const c = atual.competitors[indice];
        if (!kart && !parcial) {
          temLimpeza = true;
          return { indice, kart: '', nome: c.name, customerId: c.customerId ?? null };
        }
        if (fora.has(kart)) throw new Error(`O kart ${kart} está fora de operação.`);
        if (atual.type !== 'classificacao' && !kartLiberadoHoje(d.store, kart)) throw new Error(`Kart ${kart}: checklist e aceite diário pendentes.`);
        if (parcial && c.kart) throw new Error(`${c.name} já tem o kart ${c.kart}.`);
        const dono = atual.competitors.find((o, i) => i !== indice && o.kart === kart && real(o));
        if (dono && (parcial || !lista.some((x) => chave({ customerId: x.customerId, nome: x.nome }) === chave(dono)))) throw new Error(`O kart ${kart} já está com ${dono.name}.`);
        alvos.push(c);
        return { indice, kart, nome: c.name, customerId: c.customerId ?? null };
      });
      if (alvos.length) await exigeElegiveis(atual, alvos);
      if (temLimpeza) {
        const porIndice = new Map(atrib.map((x) => [x.indice, x.kart]));
        await d.legado('PATCH', `/api/sessions/${id}`, {
          competitors: atual.competitors.map((c, i) => ({
            kart: porIndice.has(i) ? porIndice.get(i)! : c.kart,
            name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes,
          })),
        });
        return { gravados: atrib.length };
      }
      await d.legado('POST', `/api/sessions/${id}/sorteio`, { atribuicoes: atrib, modo: pl.modo ?? (parcial ? 'fiscal' : 'todos') });
      return { gravados: atrib.length };
    });
  }

  const autor = (q: Identidade) => `${q.nome} (app)`;
  const FLAGS = new Set(['verde', 'amarela', 'vermelha', 'branca', 'quadriculada']);
  const FLAGS_PILOTO = new Set(['black', 'none', 'green', 'yellow', 'red', 'white', 'warning', 'blue', 'mechanical']);

  return {
    aberturaFrota: abertura.comandar,
    async atualizarTemposGalpao() {
      const vistas = new Set<number>();
      for (const s of (d.listarSessoes?.() ?? []) as Sessao[]) {
        if (!s.agendaId || !['preparando', 'em_andamento', 'bandeira_final'].includes(s.state) || vistas.has(s.agendaId)) continue;
        vistas.add(s.agendaId);
        await painelSorteio(s.id);
      }
    },
    async aoVivo(id: string) {
      sessao(id);
      const v = await d.legado('GET', `/api/sessions/${id}`) as { state?: string; remainingMs?: number | null; aguardandoLargada?: boolean; currentFlag?: unknown; standings?: Record<string, unknown>[] };
      return {
        state: v.state, remainingMs: v.remainingMs ?? null, aguardandoLargada: Boolean(v.aguardandoLargada), flag: v.currentFlag ?? null,
        standings: (v.standings ?? []).map((l) => ({
          position: l.position, kart: l.kart, name: l.name, laps: l.laps, bestLapMs: l.bestLapMs,
          lastLapMs: l.lastLapMs ?? null, gapMs: l.gapMs ?? null, gapLaps: l.gapLaps ?? 0, flag: l.flag ?? null,
          ...(l.penaltyMs !== undefined ? { penaltyMs: l.penaltyMs } : {}),
          ...(l.advertencias !== undefined ? { advertencias: l.advertencias } : {}),
          ...(l.desclassificado !== undefined ? { desclassificado: Boolean(l.desclassificado) } : {}),
        })),
      };
    },
    async passagens(id: string, kart: string | null) {
      sessao(id);
      const rows = await d.legado('GET', `/api/sessions/${id}/passings`) as Record<string, unknown>[];
      return { sessionRevision: d.store.revisao(id), passagens: (Array.isArray(rows) ? rows : []).filter((r) => !kart || r.kart === kart).slice(0, 300).map((r) => ({ id: r.id, kart: r.kart, name: r.name, voltas: r.voltas, lapMs: r.lapMs, wallMs: r.wallMs, invalid: r.invalid, deleted: r.deleted, rejected: r.rejected, reason: r.reason, source: r.source, estimada: r.estimada, referenciaKart: r.referenciaKart, referenciaPassagem: r.referenciaPassagem })) };
    },
    corrigirPassagem(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { action?: string; ids?: string[]; kart?: string; name?: string; lapMs?: number; quantidade?: number; posicao?: number; referencia?: string };
      const action = String(pl.action);
      const emLote = ['delete', 'restore', 'invalidate', 'validate'].includes(action);
      const atribuir = action === 'assign' || action === 'unassign';
      const manual = action === 'manual';
      const especial = action === 'tap' || action === 'recover';
      if (!emLote && !atribuir && !manual && !especial) throw new ErroApp(400, 'INVALID_REQUEST', 'Correção inválida.');
      if ((emLote || atribuir) && (!Array.isArray(pl.ids) || !pl.ids.length)) throw new ErroApp(400, 'INVALID_REQUEST', 'Correção inválida.');
      if (action === 'assign' && !texto(pl.kart, 6)) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o kart de destino.');
      if (manual && (!texto(pl.kart, 6) || !(Number(pl.lapMs) > 0))) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o kart e o tempo da volta.');
      exigeMotivo(b);
      return roda(q, 'passagem.corrigir', b, id, `passing-${action}`, async () => {
        exigeEstado(sessao(id), 'em_andamento', 'bandeira_final', 'encerrada');
        if (especial) {
          if (!sessao(id).competitors.some(c => c.kart === pl.kart)) throw new Error('Piloto não encontrado.');
          return d.legado('POST', `/api/sessions/${id}/passings/${action}`, { ...pl, operationId: b.operationId, motivo: texto(b.reason), autor: autor(q) });
        }
        if (manual) {
          const kart = texto(pl.kart, 6);
          await d.legado('POST', `/api/sessions/${id}/passings/manual`, { kart, lapMs: Math.round(Number(pl.lapMs)), name: texto(pl.name, 80) });
          await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Passagem manual incluída (kart ${kart}): ${texto(b.reason)}`, author: autor(q), kind: 'system' }).catch(() => null);
          return { count: 1 };
        }
        if (atribuir) {
          if (action === 'assign' && !sessao(id).competitors.some(c => c.kart === texto(pl.kart, 6))) throw new Error('Kart de destino não está nesta bateria.');
          const kart = action === 'unassign' ? '' : texto(pl.kart, 6);
          for (const pid of pl.ids!) {
            await d.legado('POST', `/api/sessions/${id}/passings/${encodeURIComponent(String(pid))}/${action}`, { kart, name: texto(pl.name, 80) });
          }
          await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Passagem ${action === 'assign' ? `atribuída ao kart ${kart}` : 'desvinculada'}: ${texto(b.reason)}`, author: autor(q), kind: 'system' }).catch(() => null);
          return { count: pl.ids!.length };
        }
        const r = await d.legado('POST', `/api/sessions/${id}/passings/actions`, { action, ids: pl.ids }) as { count?: number };
        await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Passagem corrigida (${action}): ${texto(b.reason)}`, author: autor(q), kind: 'system' }).catch(() => null);
        if (!r.count) throw new Error('Nada mudou: essa passagem não pode ter essa correção.');
        return { count: r.count };
      });
    },
    compararKarts(kart: string, referencia: string, trackId: string | null) { return compararHistorico((d.sessoesHistoricas?.() ?? d.listarSessoes?.() ?? []) as never, { kart, referencia, trackId, now: Date.now() }); },
    equalizacoes: () => d.legado('GET', '/api/equalizacao').then((r) => ({ equalizacoes: ((r as { equalizacoes?: { id: string }[] }).equalizacoes ?? []).map((e) => ({ ...e, sessionRevision: d.store.revisao(e.id) })) })),
    equalizacao: (id: string) => d.legado('GET', `/api/equalizacao/${encodeURIComponent(id)}`).then((r) => ({ ...(r as object), chassis: chassisFrota(d.store), sessionRevision: d.store.revisao(id) })),
    async opcoesEqualizacao() {
      const [regras, metas] = await Promise.all([d.legado('GET', '/api/equalizacao/regras'), d.legado('GET', '/api/equalizacao/metas')]) as [{ regras?: unknown[] }, { metas?: unknown[]; tracks?: unknown[] }];
      return { regras: regras.regras ?? [], metas: metas.metas ?? [], tracks: metas.tracks ?? [] };
    },
    criarEqualizacao(q: Identidade, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      return roda(q, 'equalizacao.gerir', b, 'equalizacao-nova', 'equalization-create', () => d.legado('POST', '/api/equalizacao', { nome: pl.nome, trackId: pl.trackId ?? null, referencias: pl.referencias, metaModo: pl.metaModo, metaSeg: pl.metaSeg, regra: pl.regra, frotas: pl.frotas, mecanico: pl.mecanico, autor: autor(q) }).then((r) => ({ id: (r as { id?: string }).id })));
    },
    comandoEqualizacao(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      const acao = String(pl.acao);
      const base = `/api/equalizacao/${encodeURIComponent(id)}`;
      const kart = texto(pl.kart, 6);
      const execucoes: Record<string, () => Promise<unknown>> = {
        finalizar: () => d.legado('POST', `${base}/finalizar`, { autor: autor(q) }),
        reabrir: () => d.legado('POST', `${base}/reabrir`, { autor: autor(q) }),
        config: () => d.legado('PATCH', base, { nome: pl.nome, referencias: pl.referencias, metaModo: pl.metaModo, metaSeg: pl.metaSeg, regra: pl.regra, mecanico: pl.mecanico }),
        abertura: () => d.legado('PATCH', base, { abertura: { kart, bloco: pl.bloco, mm: pl.mm } }),
        redutor: () => d.legado('PATCH', base, { redutorInicial: { kart, mm: pl.mm } }),
        importar: () => d.legado('POST', `${base}/importar`, { sessionId: pl.sessionId, karts: pl.karts, autor: autor(q) }),
        checklist: async () => {
          // a rota troca o checklist inteiro: parte do que está gravado e só muda o que veio
          const atual = await d.legado('GET', base) as { resultado?: { karts?: { kart: string; piloto?: string; checklist?: { sistemas?: unknown; observacoes?: string; acaoOficina?: string } | null }[] } };
          const c = atual.resultado?.karts?.find((k) => k.kart === kart)?.checklist;
          return d.legado('PUT', `${base}/karts/${encodeURIComponent(kart)}`, {
            sistemas: pl.sistemas ?? c?.sistemas ?? {}, observacoes: pl.observacoes ?? c?.observacoes ?? '', acaoOficina: pl.acaoOficina ?? c?.acaoOficina ?? '', autor: autor(q),
            ...(pl.confirmacaoMm !== undefined ? { confirmacaoManual: pl.confirmacaoMm === null ? null : { aberturaMm: pl.confirmacaoMm, semTeste: pl.semTeste === true } } : {}),
          });
        },
      };
      const fn = execucoes[acao];
      if (!fn) throw new ErroApp(400, 'INVALID_REQUEST', 'Comando inválido.');
      if (acao === 'finalizar' || acao === 'reabrir') exigeMotivo(b);
      return roda(q, 'equalizacao.gerir', b, id, `equalization-${acao}`, async () => {
        // finalizada guarda a meta e regras do resultado: só reabrindo para mudar parâmetros da sessão ou importar voltas
        const info = (await d.legado('GET', base)) as { finalizadaEm?: number | null };
        const permiteFinalizada = acao === 'checklist' || acao === 'redutor' || acao === 'abertura';
        if (acao !== 'reabrir' && acao !== 'finalizar' && !permiteFinalizada && info.finalizadaEm) {
          throw new ErroApp(409, 'STATE_CONFLICT', 'Equalização finalizada: reabra antes de alterar.');
        }
        if (acao === 'checklist' && pl.confirmacaoMm != null && pl.semTeste === true) {
          const estado = (d.store.db.prepare('SELECT estado FROM karts_fora WHERE kart = ?').get(kart) as { estado?: string } | undefined)?.estado;
          const podeLiberarOficina = q.perfil === 'GERENCIA';
          if (estado === 'oficina' && !podeLiberarOficina) throw new ErroApp(403, 'FORBIDDEN', 'Kart na oficina por manutenção: não pode ser liberado por equalização sem teste.');
        }
        const r = await fn() as { importados?: unknown; ignorados?: unknown };
        if (acao === 'checklist' && pl.confirmacaoMm != null && pl.semTeste === true) {
          d.store.transacao(() => {
            const estadoAtual = (d.store.db.prepare('SELECT estado FROM karts_fora WHERE kart = ?').get(kart) as { estado?: string } | undefined)?.estado;
            const podeLiberarOficina = q.perfil === 'GERENCIA';
            if (estadoAtual === 'oficina' && !podeLiberarOficina) throw new ErroApp(403, 'FORBIDDEN', 'Kart na oficina por manutenção: não pode ser liberado por equalização sem teste.');
            d.store.db.prepare('INSERT OR REPLACE INTO karts_sem_teste (kart, sessionId, autor, em) VALUES (?, ?, ?, ?)').run(kart, id, q.usuario, new Date().toISOString());
            if (estadoAtual === 'equalizar' || (estadoAtual === 'oficina' && podeLiberarOficina)) d.store.db.prepare('DELETE FROM karts_fora WHERE kart = ?').run(kart);
            d.store.subirRevisao('frota');
          });
        }
        if (acao === 'checklist' && pl.confirmacaoMm === null) {
          d.store.transacao(() => {
            d.store.db.prepare('DELETE FROM karts_sem_teste WHERE kart = ? AND sessionId = ?').run(kart, id);
            d.store.subirRevisao('frota');
          });
        }
        return acao === 'importar' ? { importados: r.importados ?? [], ignorados: r.ignorados ?? [] } : { ok: true };
      });
    },
    salvarRegra(q: Identidade, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      return roda(q, 'equalizacao.gerir', b, 'equalizacao-regras', 'equalization-rule', () => d.legado('POST', '/api/equalizacao/regras', { id: pl.id, nome: pl.nome, toleranciaSeg: pl.toleranciaSeg, faixaSeg: pl.faixaSeg, passoMm: pl.passoMm, limiteSeg: pl.limiteSeg, faixa2Seg: pl.faixa2Seg, passo2Mm: pl.passo2Mm, autor: autor(q) }).then(() => ({ ok: true })));
    },
    salvarMeta(q: Identidade, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      return roda(q, 'equalizacao.gerir', b, 'equalizacao-metas', 'equalization-target', () => d.legado('POST', '/api/equalizacao/metas', { trackId: pl.trackId ?? null, metaSeg: pl.metaSeg, toleranciaSeg: pl.toleranciaSeg, autor: autor(q) }).then(() => ({ ok: true })));
    },
    /** Números do dia para o dono, só do que a cronometragem e o app sabem. */
    resumoDoDia(sessoes: unknown[], agora = new Date()) {
      const dia = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const hoje = dia(agora.getTime());
      const doDia = (sessoes as (Sessao & { createdAt: number; type?: string })[]).filter((s) => dia(s.createdAt) === hoje && s.state !== 'cancelada' && s.type !== 'equalizacao');
      const desde = new Date(agora.getTime() - 86_400_000).toISOString();
      const contar = (acao: string) => (d.store.db.prepare(`SELECT COUNT(*) n FROM auditoria WHERE action = ? AND status = 'APPLIED' AND timestampServerUTC >= ?`).get(acao, desde) as { n: number }).n;
      const incertos = d.store.db.prepare(`SELECT operationId, command, sessionId, atualizadoEm FROM operacoes WHERE status = 'UNKNOWN' AND criadoEm >= ? ORDER BY criadoEm DESC LIMIT 10`).all(desde);
      const incertosTotal = (d.store.db.prepare(`SELECT COUNT(*) n FROM operacoes WHERE status = 'UNKNOWN' AND criadoEm >= ?`).get(desde) as { n: number }).n;
      const naPista = (s: Sessao) => s.state === 'em_andamento' || s.state === 'bandeira_final';
      const viva = doDia.find(naPista);
      const standingsViva = Array.isArray(viva?.standings) ? viva.standings as Record<string, unknown>[] : [];
      const lider = standingsViva[0];
      return {
        ...indicadoresDia(doDia),
        pilotosAgora: doDia.filter(naPista).reduce((n, s) => n + s.competitors.filter(real).length, 0),
        ultimas24h: { punicoes: contar('penalty'), trocas: contar('kart-swap'), sorteios: contar('draw'), atrasados: contar('late-assignment'), origem: 'app-v1' as const },
        frota: (() => { const f = this.frota(sessoes); const bloqueados = new Set(f.fora.map(x => x.kart)); const pista = new Set(f.naPista.map(x => x.kart)); return { disponiveis: f.cadastrados.filter(k => !bloqueados.has(k) && !pista.has(k) && kartLiberadoHoje(d.store, k)).length, oficina: f.fora.filter(x => x.estado !== 'equalizar').length, equalizar: f.fora.filter(x => x.estado === 'equalizar').length }; })(),
        frotaFora: (d.store.db.prepare('SELECT COUNT(*) n FROM karts_fora').get() as { n: number }).n,
        incertos,
        incertosTotal,
        bateriaAtiva: viva ? {
          id: viva.id,
          name: viva.name,
          state: viva.state,
          flag: viva.currentFlag ?? null,
          remainingMs: viva.remainingMs ?? null,
          pilotos: viva.competitors.filter(real).length,
          lider: lider ? { kart: String(lider.kart ?? ''), name: String(lider.name ?? ''), bestLapMs: (lider.bestLapMs as number | null) ?? null, laps: Number(lider.laps ?? 0) } : null,
        } : null,
      };
    },
    aulas() {
      const recibos = d.store.db.prepare('SELECT * FROM aulas ORDER BY criadoEm DESC LIMIT 200').all() as { id: string; instrutor: string; pilotos: number; aulas: number; valorCentavos: number; criadoEm: string; criadoPor: string; aceitoEm: string | null; aceitoPor: string | null }[];
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const desde = new Date(`${hoje}T00:00:00-03:00`).toISOString();
      const ate = new Date(Date.parse(desde) + 86400000).toISOString();
      const resumoHoje = d.store.db.prepare('SELECT instrutor, SUM(pilotos) pilotos, SUM(aulas) aulas FROM aulas WHERE criadoEm >= ? AND criadoEm < ? GROUP BY instrutor').all(desde, ate) as { instrutor: string; pilotos: number; aulas: number }[];
      return { recibos, resumoHoje, sessionRevision: d.store.revisao('aulas') };
    },
    async registrarAula(q: Identidade, b: Record<string, unknown>) {
      const p = (b.payload ?? {}) as Record<string, unknown>;
      if (!['Anderson', 'Felisberto'].includes(String(p.instrutor)) || !Number.isInteger(p.pilotos) || Number(p.pilotos) < 1 || Number(p.pilotos) > 1000 || !Number.isInteger(p.aulas) || Number(p.aulas) < 1 || Number(p.aulas) > 1000 || !Number.isSafeInteger(p.valorCentavos) || Number(p.valorCentavos) < 0 || Number(p.valorCentavos) > 100000000) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe instrutor, pilotos, aulas e valor válidos.');
      return roda(q, 'aulas.registrar', b, 'aulas', 'lesson-create', async () => {
        d.store.db.prepare('INSERT INTO aulas (id, instrutor, pilotos, aulas, valorCentavos, criadoEm, criadoPor) VALUES (?, ?, ?, ?, ?, ?, ?)').run(String(b.operationId), String(p.instrutor), Number(p.pilotos), Number(p.aulas), Number(p.valorCentavos), new Date().toISOString(), q.usuario);
        d.store.subirRevisao('aulas');
        return { id: b.operationId };
      });
    },
    async aceitarAula(q: Identidade, id: string, b: Record<string, unknown>) {
      return roda(q, 'aulas.aceitar', b, 'aulas', 'lesson-accept', async () => {
        const r = d.store.db.prepare('UPDATE aulas SET aceitoEm = ?, aceitoPor = ? WHERE id = ? AND aceitoEm IS NULL').run(new Date().toISOString(), q.usuario, id);
        if (!r.changes) throw new Error('Recibo não encontrado ou já aceito.');
        d.store.subirRevisao('aulas');
        return { id };
      });
    },
    async agenda(q: Identidade, data: string | null) {
      if (!pode(q.perfil, 'sessoes.ver')) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão.');
      return { baterias: await d.legado('GET', `/api/agenda${data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? `?data=${data}` : ''}`) };
    },
    painelSorteio: async (q: Identidade, id: string) => {
      const p = await painelSorteio(id);
      // peso e cadastro só para quem pesa
      return pode(q.perfil, 'peso.conferir') ? p : { ...p, pilotos: p.pilotos.map((x) => ({ ...x, pesoKg: null, lastro: null, customerId: null })) };
    },
    async detalhe(id: string) {
      const s = sessao(id);
      return {
        state: s.state,
        competitors: s.competitors.filter(real).map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, penalidades: c.penalidades ?? [], alertasPerigosos: alertasPerigosos(c as never), flag: c.flag ?? null })),
        standings: s.standings ?? null,
        observations: Array.isArray(s.observations) ? s.observations.slice(0, 50) : [],
      };
    },
    frota(sessoesInput?: unknown[]) {
      const fora = d.store.db.prepare('SELECT kart, motivo, usuario, em, estado FROM karts_fora ORDER BY CAST(kart AS INTEGER)').all() as { kart: string; motivo: string; usuario: string; em: string; estado: string }[];
      const listaSessoes = (sessoesInput ?? d.listarSessoes?.() ?? []) as Sessao[];
      const naPista: { kart: string; sessaoId: string; bateria: string; piloto: string; estado: string }[] = [];
      const vistos = new Set<string>();
      for (const s of listaSessoes) {
        if (s.state !== 'em_andamento' && s.state !== 'bandeira_final' && s.state !== 'preparando') continue;
        for (const c of s.competitors ?? []) {
          if (!c.kart || !real(c) || vistos.has(c.kart)) continue;
          vistos.add(c.kart);
          naPista.push({ kart: c.kart, sessaoId: s.id, bateria: s.name, piloto: c.name, estado: s.state });
        }
      }
      const cadastrados = d.kartsCadastrados?.() ?? [];
      const semTeste = d.store.db.prepare('SELECT kart, sessionId, autor, em, ajusteMm FROM karts_sem_teste ORDER BY em DESC').all() as { kart: string; sessionId: string; autor: string; em: string; ajusteMm: number | null }[];
      return { fora, naPista, cadastrados, semTeste, chassis: chassisFrota(d.store), abertura: abertura.resumo(), sessionRevision: d.store.revisao('frota') };
    },
    ordensServico() {
      const ordens = d.store.db.prepare('SELECT * FROM ordens_servico ORDER BY criadaEm DESC LIMIT 200').all();
      return { ordens, chassis: chassisFrota(d.store), sessionRevision: d.store.revisao('manutencao') };
    },
    async criarOrdemServico(q: Identidade, b: Record<string, unknown>) {
      const p = (b.payload ?? {}) as Record<string, unknown>;
      const kart = texto(p.kart, 4); const motivo = texto(p.motivo, 200); const mecanico = texto(p.mecanico, 80);
      if (!/^[0-9]{1,4}$/.test(kart) || !motivo || !mecanico) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe kart, defeito e mecânico responsável.');
      return roda(q, 'manutencao.gerir', b, 'manutencao', 'work-order-create', async () => {
        const chassiRow = d.store.db.prepare('SELECT chassi FROM karts_chassi WHERE kart = ?').get(kart) as { chassi: string } | undefined;
        const chassiInformado = texto(p.chassi, 80);
        const chassi = chassiInformado || chassiRow?.chassi || null;
        if (chassiInformado && chassiInformado !== chassiRow?.chassi) {
          d.store.db.prepare('INSERT OR REPLACE INTO karts_chassi (kart, chassi, atualizadoPor, atualizadoEm) VALUES (?, ?, ?, ?)').run(kart, chassiInformado, q.usuario, new Date().toISOString());
          d.store.subirRevisao('frota');
        }
        const bloqueio = d.store.db.prepare('SELECT estado FROM karts_fora WHERE kart = ?').get(kart) as { estado: string } | undefined;
        if (p.encaminharOficina === true) {
          if (bloqueio?.estado !== 'oficina') {
            d.store.db.prepare("INSERT OR REPLACE INTO karts_fora (kart, motivo, usuario, em, estado) VALUES (?, ?, ?, ?, 'oficina')")
              .run(kart, motivo, q.usuario, new Date().toISOString());
            d.store.subirRevisao('frota');
          }
        } else if (bloqueio?.estado !== 'oficina') {
          throw new Error('A ordem de serviço exige que o kart esteja na aba Oficina.');
        }
        const ativa = d.store.db.prepare("SELECT id FROM ordens_servico WHERE kart = ? AND status IN ('aberta','em_execucao')").get(kart);
        if (ativa) throw new Error('Este kart já tem uma ordem de serviço aberta.');

        const numKart = kart.padStart(3, '0');
        const numChassi = chassi ? (chassi.replace(/\D/g, '').slice(-3) || chassi.slice(0, 3)).padStart(3, '0') : '000';
        let codigo = `OS-${numKart}${numChassi}`;
        const totalExistente = (d.store.db.prepare('SELECT COUNT(*) as c FROM ordens_servico WHERE codigo = ?').get(codigo) as { c: number } | undefined)?.c ?? 0;
        if (totalExistente > 0) {
          codigo = `${codigo}-${totalExistente + 1}`;
        }

        const agora = new Date().toISOString();
        d.store.transacao(() => {
          d.store.db.prepare('INSERT INTO ordens_servico (id, codigo, kart, chassi, motivo, mecanico, status, criadaEm, criadaPor, atualizadaEm, atualizadaPor, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(String(b.operationId), codigo, kart, chassi, motivo, mecanico, 'aberta', agora, q.usuario, agora, q.usuario, texto(p.observacao, 500) || null);
          d.store.subirRevisao('manutencao');
        });
        return { id: b.operationId, codigo };
      });
    },
    async atualizarOrdemServico(q: Identidade, id: string, b: Record<string, unknown>) {
      const p = (b.payload ?? {}) as Record<string, unknown>;
      const status = String(p.status ?? '');
      if (!['em_execucao', 'concluida', 'cancelada'].includes(status)) throw new ErroApp(400, 'INVALID_REQUEST', 'Situação da ordem inválida.');
      return roda(q, 'manutencao.gerir', b, 'manutencao', 'work-order-status', async () => {
        const atual = d.store.db.prepare('SELECT status FROM ordens_servico WHERE id = ?').get(id) as { status: string } | undefined;
        if (!atual) throw new ErroApp(404, 'NOT_FOUND', 'Ordem de serviço não encontrada.');
        const permitida = atual.status === 'aberta' ? ['em_execucao', 'cancelada'] : atual.status === 'em_execucao' ? ['concluida', 'cancelada'] : [];
        if (!permitida.includes(status)) throw new Error('Transição inválida para esta ordem de serviço.');
        const mecanico = texto(p.mecanico, 80);
        if (p.mecanico !== undefined && !mecanico) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o mecânico responsável.');
        const servicoRealizado = texto(p.servicoRealizado, 1000) || texto(p.observacao, 1000) || null;
        const agora = new Date().toISOString();
        d.store.transacao(() => {
          d.store.db.prepare(`
            UPDATE ordens_servico
            SET status = ?,
                mecanico = COALESCE(?, mecanico),
                servicoRealizado = COALESCE(?, servicoRealizado),
                observacao = COALESCE(?, observacao),
                concluidaEm = CASE WHEN ? = 'concluida' THEN ? ELSE concluidaEm END,
                concluidaPor = CASE WHEN ? = 'concluida' THEN ? ELSE concluidaPor END,
                atualizadaEm = ?,
                atualizadaPor = ?
            WHERE id = ?
          `).run(
            status,
            p.mecanico === undefined ? null : mecanico,
            servicoRealizado,
            p.observacao === undefined ? null : texto(p.observacao, 500),
            status, agora,
            status, q.usuario,
            agora, q.usuario,
            id
          );
          d.store.subirRevisao('manutencao');
        });
        return { id };
      });
    },
    chassiKart(q: Identidade, kart: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      return roda(q, 'frota.gerir', { ...b, payload: { ...pl, kart } }, 'frota', 'fleet-chassis', async () => {
        exigeMotivo(b);
        return gravarChassi(d.store, kart, pl.chassi, q.usuario, d.kartsCadastrados?.());
      });
    },
    async marcarKart(q: Identidade, kart: string, b: Record<string, unknown>, registrarAuditoria = true): Promise<RespostaOperacao | FrotaSnapshot> {
      if (b.operationId != null) {
        const pl = (b.payload ?? {}) as Record<string, unknown>;

        return roda(q, pl.equalizadoSemTeste === true ? 'equalizacao.gerir' : 'frota.gerir', b, 'frota', 'fleet', async () => {
          if (pl.equalizadoSemTeste !== true) return this.marcarKart(q, kart, { ...pl, reason: exigeMotivo(b) }, false);
          const ajusteMm = Number(String(pl.ajusteMm ?? '').replace(',', '.'));
          if (pl.ajusteMm == null || String(pl.ajusteMm).trim() === '' || !Number.isFinite(ajusteMm) || Math.abs(ajusteMm) > 20) throw new Error('Informe o ajuste aplicado entre -20 e 20 mm.');
          const atual = d.store.db.prepare('SELECT estado FROM karts_fora WHERE kart = ?').get(kart) as { estado: string } | undefined;
          if (atual?.estado !== 'equalizar') throw new Error('Encaminhe o kart para Equalizar antes de confirmar.');
          exigeMotivo(b);
          d.store.transacao(() => {
            const estadoAtual = (d.store.db.prepare('SELECT estado FROM karts_fora WHERE kart = ?').get(kart) as { estado?: string } | undefined)?.estado;
            if (estadoAtual !== 'equalizar') throw new Error('O kart deixou de estar encaminhado para Equalizar.');
            d.store.db.prepare('INSERT OR REPLACE INTO karts_sem_teste (kart, sessionId, autor, em, ajusteMm) VALUES (?, ?, ?, ?, ?)').run(kart, `fleet-${kart}`, q.usuario, new Date().toISOString(), ajusteMm);
            d.store.db.prepare('DELETE FROM karts_fora WHERE kart = ?').run(kart);
            d.store.subirRevisao('frota');
          });
          return this.frota();
        });
      }

      if (!pode(q.perfil, 'frota.gerir')) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão.');
      if ((b.fora === false || b.estado === 'equalizar' || karts().has(kart)) && !pode(q.perfil, 'frota.liberar')) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão para liberar ou encaminhar para equalização.');
      if (b.fora === false && q.perfil === 'EQUALIZACAO') {
        const estado = (d.store.db.prepare('SELECT estado FROM karts_fora WHERE kart = ?').get(kart) as { estado?: string } | undefined)?.estado;
        if (estado !== 'equalizar') throw new ErroApp(403, 'FORBIDDEN', 'Responsável de equalização só libera kart encaminhado para Equalizar.');
      }
      if (!/^\d{1,3}$/.test(kart) || (d.kartsCadastrados && !d.kartsCadastrados().includes(kart))) throw new ErroApp(400, 'INVALID_REQUEST', 'Kart não cadastrado.');
      if (b.fora === false) d.store.db.prepare('DELETE FROM karts_fora WHERE kart = ?').run(kart);
      else d.store.db.prepare('INSERT OR REPLACE INTO karts_fora (kart, motivo, usuario, em, estado) VALUES (?, ?, ?, ?, ?)').run(kart, exigeMotivo(b), q.usuario, new Date().toISOString(), b.estado === 'equalizar' ? 'equalizar' : 'oficina');
      if (registrarAuditoria) d.store.db.prepare(`INSERT INTO auditoria (auditId, actorUserId, actorRole, deviceId, timestampServerUTC, routeMode, action, reason, status, sourceSystem) VALUES (?, ?, ?, ?, ?, ?, 'fleet', ?, 'APPLIED', 'app-v1')`)
        .run(randomUUID(), q.usuarioId, q.perfil, q.deviceId, new Date().toISOString(), d.routeMode ?? 'internet', `kart ${kart}: ${b.fora === false ? 'voltou' : texto(b.reason)}`);
      d.store.subirRevisao('frota');
      return this.frota();
    },
    preparar: (q: Identidade, agendaId: number, b: Record<string, unknown>) => roda(q, 'bateria.preparar', b, `agenda-${agendaId}`, 'prepare', () => d.legado('POST', `/api/agenda/${agendaId}/preparar`, { nome: texto(b.nome, 80) })),
    sorteio: (q: Identidade, id: string, b: Record<string, unknown>) => gravarKarts(q, id, b, false),
    atrasados: (q: Identidade, id: string, b: Record<string, unknown>) => gravarKarts(q, id, b, true),
    peso(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { customerId?: string | null; nome?: string; pesoKg?: number; lastroConferido?: boolean; postRace?: boolean };
      if (!pesoValido(pl.pesoKg)) throw new ErroApp(400, 'INVALID_REQUEST', 'Digite um peso entre 20 e 250 kg.');
      if (pl.postRace === true) {
        // pesagem oficial depois da prova: só registra o resultado, não mexe no peso nem no lastro da bateria
        return roda(q, 'peso.conferir', b, id, 'weight-check-postrace', async () => {
          const s = sessao(id);
          exigeEstado(s, 'em_andamento', 'bandeira_final', 'encerrada');
          const c = s.competitors.find((x) => chave(x) === chave({ customerId: pl.customerId, nome: pl.nome }));
          if (!c) throw new Error('Piloto não está nesta bateria.');
          await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Pesagem pós-corrida · ${c.name} (kart ${c.kart}): ${pl.pesoKg} kg, peso regular`, author: autor(q), kind: 'system' });
          return { ok: true };
        });
      }
      return roda(q, 'peso.conferir', b, id, 'weight-check', async () => {
        const s = sessao(id);
        exigeEstado(s, 'preparando', 'em_andamento');
        const indice = s.competitors.findIndex((c) => chave(c) === chave({ customerId: pl.customerId, nome: pl.nome }));
        if (indice < 0) throw new Error('Piloto não está nesta bateria.');
        const c = s.competitors[indice];
        const frota = frotaDoKart(c.kart);
        const plano = frota ? planoLastro(pl.pesoKg as number, frota) : null;
        await d.legado('PUT', `/api/sessions/${id}/competitors/${indice}`, {
          kartAntes: c.kart, nomeAntes: c.name, kart: c.kart, name: c.name, aplicarGrupo: true,
          detalhes: { ...c.detalhes, peso: pl.pesoKg, pesoLastro: plano?.lastroKg ?? null },
        });
        // a rota da cronometragem não guarda a conferência: fica no banco do app, ligada ao kart
        if (pl.lastroConferido === true) d.store.db.prepare('INSERT OR REPLACE INTO lastros_conferidos (sessionId, chave, kart, pesoKg, usuario, em) VALUES (?, ?, ?, ?, ?, ?)').run(id, chave(c), c.kart, pl.pesoKg as number, q.usuario, new Date().toISOString());
        if (pl.lastroConferido === true) atualizarConclusaoGalpao(s);
        return plano;
      });
    },
    /** Confere de uma vez todos os pilotos da lista que já têm peso válido (o operador conferiu as placas de cada kart). */
    pesoLote(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { pilotos?: { customerId?: string | null; nome?: string; pesoKg?: number }[] };
      const itens = Array.isArray(pl.pilotos) ? pl.pilotos : [];
      if (!itens.length || itens.length > 100) throw new ErroApp(400, 'INVALID_REQUEST', 'Nenhum piloto para conferir.');
      if (itens.some((i) => !pesoValido(i.pesoKg))) throw new ErroApp(400, 'INVALID_REQUEST', 'Há piloto sem peso válido (20 a 250 kg).');
      return roda(q, 'peso.conferir', b, id, 'weight-check-batch', async () => {
        const s = sessao(id);
        exigeEstado(s, 'preparando', 'em_andamento');
        const feitos: string[] = [];
        for (const i of itens) {
          const c = s.competitors.find((x) => chave(x) === chave({ customerId: i.customerId, nome: i.nome }));
          if (!c) continue;
          const frota = frotaDoKart(c.kart);
          const plano = frota ? planoLastro(i.pesoKg as number, frota) : null;
          await d.legado('PUT', `/api/sessions/${id}/competitors/${s.competitors.indexOf(c)}`, {
            kartAntes: c.kart, nomeAntes: c.name, kart: c.kart, name: c.name, aplicarGrupo: true,
            detalhes: { ...c.detalhes, peso: i.pesoKg, pesoLastro: plano?.lastroKg ?? null },
          });
          d.store.db.prepare('INSERT OR REPLACE INTO lastros_conferidos (sessionId, chave, kart, pesoKg, usuario, em) VALUES (?, ?, ?, ?, ?, ?)').run(id, chave(c), c.kart, i.pesoKg as number, q.usuario, new Date().toISOString());
          feitos.push(c.kart);
        }
        atualizarConclusaoGalpao(s);
        return { conferidos: feitos.length };
      });
    },
    trocaKart(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { fromKart?: string; toKart?: string; customerId?: string | null; nome?: string; manterVoltas?: boolean; tipoTroca?: string };
      const para = texto(pl.toKart, 6);
      if (!para || !pl.fromKart) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o kart atual e o novo.');
      exigeMotivo(b);
      return roda(q, 'kart.trocar', b, id, 'kart-swap', async () => {
        const s = sessao(id);
        exigeEstado(s, 'preparando', 'em_andamento', 'bandeira_final');
        if (s.type !== 'classificacao' && !kartLiberadoHoje(d.store, para)) throw new Error(`Kart ${para}: checklist e aceite diário pendentes ou kart bloqueado.`);
        if (karts().has(para)) throw new Error(`O kart ${para} está fora de operação.`);
        const c = s.competitors.find((x) => x.kart === pl.fromKart && chave(x) === chave({ customerId: pl.customerId, nome: pl.nome }));
        if (!c) throw new ErroApp(409, 'STALE_ASSIGNMENT', 'O piloto não está mais nesse kart. Atualize.');
        const tipoTroca = pl.tipoTroca ?? (/Kart quebrou/i.test(String(b.reason)) ? 'quebra' : /Kart ruim/i.test(String(b.reason)) ? 'desempenho' : 'solicitacao');
        if (!['quebra', 'desempenho', 'solicitacao'].includes(tipoTroca)) throw new Error('Tipo de troca inválido.');
        if (tipoTroca !== 'solicitacao') {
          // O relato de defeito mantém o kart bloqueado mesmo se a troca falhar.
          d.store.db.prepare('INSERT OR REPLACE INTO karts_fora (kart, motivo, usuario, em, estado) VALUES (?, ?, ?, ?, ?)').run(String(pl.fromKart), texto(b.reason), q.usuario, new Date().toISOString(), tipoTroca === 'desempenho' ? 'equalizar' : 'oficina');
          d.store.subirRevisao('frota');
        }
        const r = await d.legado('POST', `/api/sessions/${id}/swap-kart`, { fromKart: pl.fromKart, toKart: para, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes ?? {}, manterVoltas: pl.manterVoltas !== false });
        await d.legado('POST', `/api/sessions/${id}/observations`, { text: `Troca de kart · ${c.name} do kart ${pl.fromKart} para o ${para}${pl.manterVoltas === false ? ` (voltas e tempos do kart ${pl.fromKart} desconsiderados)` : ''}`, author: autor(q), kind: 'kart-swap' }).catch(() => null);
        return { troca: (r as { troca?: unknown })?.troca ?? null };
      });
    },
    penalidade(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { kart?: string; tipo?: string; segundos?: number; motivo?: string; kartAtingido?: string; curva?: string; volta?: number; infracao?: string };
      if (pl.infracao && !Object.prototype.hasOwnProperty.call(INFRACOES, pl.infracao)) throw new ErroApp(400, 'INVALID_REQUEST', 'Infração inválida.');
      if (pl.tipo === 'desclassificacao' && pl.kart) {
        // a cronometragem desclassifica pela bandeira preta (vai para o último lugar); versões antigas do app mandam como penalidade
        const kart = pl.kart;
        exigeMotivo(b);
        return roda(q, 'penalidade.aplicar', b, id, 'penalty-dsq', async () => {
          exigeEstado(sessao(id), 'em_andamento', 'bandeira_final', 'encerrada');
          await d.legado('POST', `/api/sessions/${id}/flag/${encodeURIComponent(kart)}`, { flag: 'black', autor: autor(q) });
          return { ok: true };
        });
      }
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
      if (pl.relargar || flag === 'black') exigeMotivo(b);
      const cap = pl.relargar ? 'prova.reiniciar' : 'bandeira.aplicar';
      return roda(q, cap, b, id, pl.relargar ? 'relargada' : 'flag', () => d.legado('POST', pl.kart ? `/api/sessions/${id}/flag/${encodeURIComponent(pl.kart)}` : `/api/sessions/${id}/flag`, { flag, relargar: pl.relargar === true, motivo: pl.motivo, autor: autor(q) }).then(() => ({ ok: true })));
    },
    comando(q: Identidade, id: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as { acao?: string; texto?: string; kart?: string; position?: number | null };
      const acao = String(pl.acao);
      if (acao === 'observation') {
        const obs = texto(pl.texto || b.reason, 300);
        if (!obs) throw new ErroApp(400, 'INVALID_REQUEST', 'Escreva a observação.');
        return roda(q, 'prova.comandar', b, id, 'command-observation', async () => {
          sessao(id);
          await d.legado('POST', `/api/sessions/${id}/observations`, { text: obs, author: autor(q), kind: 'manual' });
          return { ok: true };
        });
      }
      if (acao === 'position') {
        const kart = texto(pl.kart, 6);
        if (!kart) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o kart.');
        exigeMotivo(b);
        return roda(q, 'prova.comandar', b, id, 'command-position', async () => {
          exigeEstado(sessao(id), 'em_andamento', 'bandeira_final', 'encerrada');
          await d.legado('POST', `/api/sessions/${id}/position`, { kart, position: pl.position ?? null, autor: autor(q) });
          return { ok: true };
        });
      }
      const vivos = ['preparando', 'em_andamento', 'bandeira_final'];
      const acoes: Record<string, { rota: string; cap: string; critico: boolean; estados: string[] }> = {
        start: { rota: 'start', cap: 'prova.comandar', critico: true, estados: ['preparando'] }, checkered: { rota: 'checkered', cap: 'prova.comandar', critico: true, estados: ['em_andamento'] },
        close: { rota: 'close', cap: 'prova.comandar', critico: true, estados: ['em_andamento', 'bandeira_final'] }, cancel: { rota: 'cancel', cap: 'prova.reiniciar', critico: true, estados: vivos }, restart: { rota: 'restart', cap: 'prova.reiniciar', critico: true, estados: vivos },
      };
      const a = acoes[acao];
      if (!a) throw new ErroApp(400, 'INVALID_REQUEST', 'Comando inválido.');
      if (a.critico) exigeMotivo(b);
      return roda(q, a.cap, b, id, `command-${acao}`, async () => {
        exigeEstado(sessao(id), ...a.estados);
        await d.legado('POST', `/api/sessions/${id}/${a.rota}`, { autor: autor(q) });
        return { ok: true };
      });
    },
  };
}
