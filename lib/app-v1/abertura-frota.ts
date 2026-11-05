import { pode, type Identidade } from './auth';
import { ErroApp, executar } from './comandos';
import type { AppStore } from './store';

export const ITENS_ABERTURA = ['freioAcelerador', 'pneus', 'corrente', 'combustivel'] as const;
export const diaAbertura = (agora = new Date()) => agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
type Registro = { dia: string; kart: string; itens: string; conferidoPor: string; conferidoEm: string; aceitoPor: string | null; aceitoEm: string | null; excecao: string | null };

/** A mesma regra atende tablet, sorteio Windows e troca de kart. Sem store não há liberação presumida. */
export function kartLiberadoHoje(store: AppStore | null, kart: string, agora = new Date()) {
  return Boolean(store && !store.db.prepare('SELECT 1 FROM karts_fora WHERE kart = ?').get(kart)
    && !store.db.prepare("SELECT 1 FROM ordens_servico WHERE kart = ? AND status IN ('aberta','em_execucao')").get(kart)
    && store.db.prepare('SELECT 1 FROM abertura_frota WHERE dia = ? AND kart = ? AND aceitoEm IS NOT NULL').get(diaAbertura(agora), kart));
}

export function invalidarAbertura(store: AppStore | null, karts: string[]) {
  if (!store) return;
  let alterados = 0;
  for (const kart of karts) alterados += Number(store.db.prepare('DELETE FROM abertura_frota WHERE kart = ?').run(kart).changes);
  if (alterados) store.subirRevisao('frota');
}

export function criarAberturaFrota(d: { store: AppStore; kartsCadastrados: () => string[]; agora?: () => Date; routeMode?: string }) {
  const agora = () => d.agora?.() ?? new Date();
  const resumo = () => {
    const dia = diaAbertura(agora());
    const registros = d.store.db.prepare('SELECT * FROM abertura_frota WHERE dia = ?').all(dia) as Registro[];
    const mapa = new Map(registros.map(r => [r.kart, r]));
    const bloqueados = new Set((d.store.db.prepare('SELECT kart FROM karts_fora UNION SELECT kart FROM ordens_servico WHERE status IN (\'aberta\',\'em_execucao\')').all() as { kart: string }[]).map(r => r.kart));
    const karts = d.kartsCadastrados().map(kart => {
      const r = mapa.get(kart);
      return { kart, estado: bloqueados.has(kart) ? 'bloqueado' : r?.aceitoEm ? 'liberado' : r ? 'aguardando' : 'pendente',
        itens: r ? JSON.parse(r.itens) as string[] : [], conferidoPor: r?.conferidoPor ?? null, conferidoEm: r?.conferidoEm ?? null,
        aceitoPor: r?.aceitoPor ?? null, aceitoEm: r?.aceitoEm ?? null, excecao: r?.excecao ?? null };
    });
    const escala = d.store.db.prepare('SELECT dia, operador FROM escala_abertura WHERE dia >= ? ORDER BY dia LIMIT 14').all(dia) as { dia: string; operador: string }[];
    const fimSemana = [0, 6].includes(new Date(`${dia}T12:00:00-03:00`).getUTCDay());
    return { dia, karts, pendentes: karts.filter(k => k.estado === 'pendente').length, aguardando: karts.filter(k => k.estado === 'aguardando').length,
      liberados: karts.filter(k => k.estado === 'liberado').length, total: karts.length, escala,
      aberturaHoje: escala.find(e => e.dia === dia)?.operador ?? (fimSemana ? 'Equipe do galpão — tarefas divididas' : 'Responsável ainda não escalado'),
      sessionRevision: d.store.revisao('frota') };
  };
  return {
    resumo,
    comandar(q: Identidade, acao: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      const gerencial = acao !== 'conferir';
      if (gerencial && q.perfil !== 'GERENCIA') throw new ErroApp(403, 'FORBIDDEN', 'Somente a gerência pode aceitar ou alterar a escala.');
      if (!pode(q.perfil, 'frota.gerir')) throw new ErroApp(403, 'FORBIDDEN', 'Sem permissão para conferir a frota.');
      const operationId = typeof b.operationId === 'string' ? b.operationId : '';
      const revisao = b.expectedSessionRevision;
      if (!operationId || typeof revisao !== 'number' || !Number.isInteger(revisao)) throw new ErroApp(400, 'INVALID_REQUEST', 'Pedido sem identificador ou revisão.');
      const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 500) : '';
      return executar({ store: d.store, identidade: q, routeMode: d.routeMode ?? 'internet', capacidade: 'frota.gerir' },
        { operationId, sessionId: 'frota', expectedSessionRevision: revisao, command: `fleet-opening-${acao}`, payload: pl, reason }, async () => {
          const em = agora().toISOString();
          const dia = diaAbertura(agora());
          if (pl.dia !== dia) throw new Error('O dia mudou. Atualize a abertura da frota.');
          d.store.transacao(() => {
            if (acao === 'escala') {
              const data = String(pl.data ?? '');
              const operador = typeof pl.operador === 'string' ? pl.operador.trim().slice(0, 80) : '';
              const dt = new Date(`${data}T12:00:00-03:00`);
              if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(dt.getTime()) || diaAbertura(dt) !== data || data < dia || !operador) throw new Error('Informe uma data futura válida e o responsável.');
              d.store.db.prepare('INSERT OR REPLACE INTO escala_abertura VALUES (?, ?, ?, ?)').run(data, operador, q.usuario, em);
            } else {
              const lista = Array.isArray(pl.karts) ? pl.karts : [];
              if (!lista.length || lista.length > 300 || new Set(lista).size !== lista.length) throw new Error('Selecione os karts sem duplicar.');
              for (const kart of lista) {
                if (typeof kart !== 'string' || !d.kartsCadastrados().includes(kart)) throw new Error('Kart não cadastrado.');
                if (d.store.db.prepare("SELECT 1 FROM karts_fora WHERE kart = ? UNION SELECT 1 FROM ordens_servico WHERE kart = ? AND status IN ('aberta','em_execucao')").get(kart, kart)) throw new Error(`Kart ${kart}: resolva a oficina/equalização antes da abertura.`);
                if (acao === 'conferir') {
                  if (lista.length !== 1 || !Array.isArray(pl.itens) || pl.itens.length !== ITENS_ABERTURA.length || !ITENS_ABERTURA.every(i => (pl.itens as unknown[]).includes(i))) throw new Error('Confira os quatro itens de cada kart.');
                  d.store.db.prepare('INSERT OR REPLACE INTO abertura_frota (dia, kart, itens, conferidoPor, conferidoEm) VALUES (?, ?, ?, ?, ?)').run(dia, kart, JSON.stringify(ITENS_ABERTURA), q.usuario, em);
                } else if (acao === 'aceitar') {
                  const r = d.store.db.prepare('SELECT aceitoEm FROM abertura_frota WHERE dia = ? AND kart = ?').get(dia, kart) as { aceitoEm: string | null } | undefined;
                  if (!r || r.aceitoEm) throw new Error(`Kart ${kart}: checklist pendente ou aceite já realizado. Atualize.`);
                  d.store.db.prepare('UPDATE abertura_frota SET aceitoPor = ?, aceitoEm = ? WHERE dia = ? AND kart = ?').run(q.usuario, em, dia, kart);
                } else if (acao === 'excecao') {
                  if (!reason) throw new Error('Informe o motivo da liberação excepcional.');
                  d.store.db.prepare('INSERT OR REPLACE INTO abertura_frota VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(dia, kart, '[]', q.usuario, em, q.usuario, em, reason);
                } else throw new Error('Ação de abertura inválida.');
              }
            }
            d.store.subirRevisao('frota');
          });
          return resumo();
        });
    },
  };
}
