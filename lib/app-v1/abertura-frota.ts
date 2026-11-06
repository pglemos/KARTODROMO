import { pode, type Identidade } from './auth';
import { ErroApp, executar } from './comandos';
import type { AppStore } from './store';

export type FrequenciaChecklist = '1x_dia' | 'cada_2_baterias' | 'cada_4_baterias';

export interface ItemChecklistDef {
  id: string;
  nome: string;
  frequencia: FrequenciaChecklist;
  frequenciaRotulo: string;
  responsavelSugerido: string;
  ativo: boolean;
}

export const ITENS_CHECKLIST_CONFIG: ItemChecklistDef[] = [
  {
    id: 'freioAcelerador',
    nome: 'Acelerador e freio',
    frequencia: '1x_dia',
    frequenciaRotulo: '01x/dia (início)',
    responsavelSugerido: 'Operador 1',
    ativo: true,
  },
  {
    id: 'calibragemPneus',
    nome: 'Calibrar pneus',
    frequencia: '1x_dia',
    frequenciaRotulo: '01x/dia (início)',
    responsavelSugerido: 'Operador 2',
    ativo: true,
  },
  {
    id: 'pneusLonados',
    nome: 'Pneus lonados',
    frequencia: 'cada_2_baterias',
    frequenciaRotulo: 'A cada 2 baterias',
    responsavelSugerido: 'Operador 2',
    ativo: true,
  },
  {
    id: 'correnteEngraxada',
    nome: 'Corrente engraxada (passar graxa)',
    frequencia: 'cada_4_baterias',
    frequenciaRotulo: 'A cada 4 baterias',
    responsavelSugerido: 'Operador 3',
    ativo: true,
  },
  {
    id: 'combustivel',
    nome: 'Abastecimento',
    frequencia: 'cada_4_baterias',
    frequenciaRotulo: 'A cada 4 baterias (temporariamente suspenso)',
    responsavelSugerido: 'Operador 3',
    ativo: false, // RETIRADO TEMPORARIAMENTE conforme solicitado
  },
];

export const ITENS_ABERTURA = ['freioAcelerador', 'calibragemPneus', 'pneusLonados', 'correnteEngraxada'] as const;
export const diaAbertura = (agora = new Date()) => agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
type Registro = {
  dia: string;
  kart: string;
  itens: string;
  conferidoPor: string;
  conferidoEm: string;
  aceitoPor: string | null;
  aceitoEm: string | null;
  excecao: string | null;
  ciclo?: string | null;
  baterias?: number | null;
};

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

export function normalizarItensChecklist(itensRecebidos: string[]): string[] {
  const conj = new Set(itensRecebidos);
  if (conj.has('pneus')) {
    conj.add('calibragemPneus');
    conj.add('pneusLonados');
  }
  if (conj.has('corrente')) {
    conj.add('correnteEngraxada');
  }
  return Array.from(conj);
}

export function criarAberturaFrota(d: {
  store: AppStore;
  kartsCadastrados: () => string[];
  agora?: () => Date;
  routeMode?: string;
  listarSessoes?: () => unknown[];
}) {
  const agora = () => d.agora?.() ?? new Date();
  const resumo = () => {
    const dia = diaAbertura(agora());
    const registros = d.store.db.prepare('SELECT * FROM abertura_frota WHERE dia = ?').all(dia) as Registro[];
    const mapa = new Map(registros.map(r => [r.kart, r]));
    const bloqueados = new Set((d.store.db.prepare('SELECT kart FROM karts_fora UNION SELECT kart FROM ordens_servico WHERE status IN (\'aberta\',\'em_execucao\')').all() as { kart: string }[]).map(r => r.kart));

    // Calcular baterias concluídas de cada kart hoje
    const bateriasPorKart = new Map<string, number>();
    try {
      const sessoes = (d.listarSessoes?.() ?? []) as { id: string; state?: string; competitors?: { kart?: string }[] }[];
      for (const s of sessoes) {
        if (s.state === 'encerrada' || s.state === 'concluida') {
          for (const c of s.competitors ?? []) {
            if (c.kart) {
              bateriasPorKart.set(c.kart, (bateriasPorKart.get(c.kart) ?? 0) + 1);
            }
          }
        }
      }
    } catch {
      // tolerante
    }

    const karts = d.kartsCadastrados().map(kart => {
      const r = mapa.get(kart);
      const bateriasHoje = r?.baterias ?? bateriasPorKart.get(kart) ?? 0;
      const estado = bloqueados.has(kart) ? 'bloqueado' : r?.aceitoEm ? 'liberado' : r ? 'aguardando' : 'pendente';
      const itensConferidos = r ? JSON.parse(r.itens) as string[] : [];

      let cicloSugerido: 'abertura' | 'cada_2_baterias' | 'cada_4_baterias' | 'em_dia' = 'abertura';
      let itensPendentes: string[] = ['freioAcelerador', 'calibragemPneus', 'pneusLonados', 'correnteEngraxada'];

      if (r?.aceitoEm) {
        if (bateriasHoje > 0 && bateriasHoje % 4 === 0) {
          cicloSugerido = 'cada_4_baterias';
          itensPendentes = ['pneusLonados', 'correnteEngraxada'];
        } else if (bateriasHoje > 0 && bateriasHoje % 2 === 0) {
          cicloSugerido = 'cada_2_baterias';
          itensPendentes = ['pneusLonados'];
        } else {
          cicloSugerido = 'em_dia';
          itensPendentes = [];
        }
      }

      return {
        kart,
        estado,
        itens: itensConferidos,
        conferidoPor: r?.conferidoPor ?? null,
        conferidoEm: r?.conferidoEm ?? null,
        aceitoPor: r?.aceitoPor ?? null,
        aceitoEm: r?.aceitoEm ?? null,
        excecao: r?.excecao ?? null,
        bateriasHoje,
        cicloSugerido,
        itensPendentes,
      };
    });

    const escala = d.store.db.prepare('SELECT dia, operador FROM escala_abertura WHERE dia >= ? ORDER BY dia LIMIT 14').all(dia) as { dia: string; operador: string }[];
    const fimSemana = [0, 6].includes(new Date(`${dia}T12:00:00-03:00`).getUTCDay());
    return {
      dia,
      karts,
      pendentes: karts.filter(k => k.estado === 'pendente').length,
      aguardando: karts.filter(k => k.estado === 'aguardando').length,
      liberados: karts.filter(k => k.estado === 'liberado').length,
      total: karts.length,
      escala,
      aberturaHoje: escala.find(e => e.dia === dia)?.operador ?? (fimSemana ? 'Equipe do galpão — tarefas divididas' : 'Responsável ainda não escalado'),
      itensConfig: ITENS_CHECKLIST_CONFIG,
      sessionRevision: d.store.revisao('frota'),
    };
  };

  return {
    resumo,
    comandar(q: Identidade, acao: string, b: Record<string, unknown>) {
      const pl = (b.payload ?? {}) as Record<string, unknown>;
      const gerencial = acao === 'aceitar' || acao === 'excecao' || acao === 'escala';
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
            } else if (acao === 'defeito') {
              // Apontamento de defeito por exceção (Etapa 3)
              const kart = String(pl.kart ?? pl.karts?.[0] ?? '').trim();
              const motivoDefeito = String(pl.motivo ?? reason ?? 'Defeito identificado no checklist').trim();
              if (!kart || !d.kartsCadastrados().includes(kart)) throw new Error('Kart não cadastrado.');
              d.store.db.prepare('INSERT OR REPLACE INTO karts_fora (kart, motivo, usuario, em, estado) VALUES (?, ?, ?, ?, ?)').run(kart, motivoDefeito, q.usuario, em, 'oficina');
              d.store.db.prepare('DELETE FROM abertura_frota WHERE kart = ?').run(kart);
            } else {
              const lista = Array.isArray(pl.karts) ? pl.karts : [];
              if (!lista.length || lista.length > 300 || new Set(lista).size !== lista.length) throw new Error('Selecione os karts sem duplicar.');
              for (const kart of lista) {
                if (typeof kart !== 'string' || !d.kartsCadastrados().includes(kart)) throw new Error('Kart não cadastrado.');
                if (d.store.db.prepare("SELECT 1 FROM karts_fora WHERE kart = ? UNION SELECT 1 FROM ordens_servico WHERE kart = ? AND status IN ('aberta','em_execucao')").get(kart, kart)) throw new Error(`Kart ${kart}: resolva a oficina/equalização antes da abertura.`);
                if (acao === 'conferir') {
                  const itensRecebidos = Array.isArray(pl.itens) ? pl.itens as string[] : [];
                  const itensNormalizados = normalizarItensChecklist(itensRecebidos);
                  const ciclo = String(pl.ciclo ?? 'abertura');

                  if (ciclo === 'cada_2_baterias') {
                    if (!itensNormalizados.includes('pneusLonados')) throw new Error('Confira a verificação de pneus lonados.');
                  } else if (ciclo === 'cada_4_baterias') {
                    if (!itensNormalizados.includes('pneusLonados') || !itensNormalizados.includes('correnteEngraxada')) {
                      throw new Error('Confira os pneus lonados e a corrente engraxada.');
                    }
                  } else {
                    // Abertura do dia (primeira checagem: todos os 4 itens ativos)
                    const ativos = ['freioAcelerador', 'calibragemPneus', 'pneusLonados', 'correnteEngraxada'];
                    const temTodos = ativos.every(i => itensNormalizados.includes(i));
                    if (!temTodos) throw new Error('Confira os quatro itens de cada kart.');
                  }

                  const gravarItens = itensNormalizados.filter(i => i !== 'combustivel');
                  d.store.db.prepare('INSERT OR REPLACE INTO abertura_frota (dia, kart, itens, conferidoPor, conferidoEm) VALUES (?, ?, ?, ?, ?)').run(
                    dia, kart, JSON.stringify(gravarItens), q.usuario, em
                  );
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

