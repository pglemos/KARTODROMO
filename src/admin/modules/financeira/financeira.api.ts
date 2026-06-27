import { apiDelete, apiGet, apiGetById, apiPatch, apiPost } from '../../lib/api-client';
import type {
  Categoria,
  CategoriaPayload,
  CategoriaUpdate,
  Lancamento,
  LancamentoPayload,
  LancamentoUpdate,
  LancamentoWithCategoria,
  ResumoFinanceiro,
} from './financeira.types';

type LancamentoFullRow = Lancamento & { categoria_nome: string | null; categoria_tipo: string | null };

export const listLancamentos = async (): Promise<LancamentoWithCategoria[]> => {
  const rows = await apiGet<LancamentoFullRow[]>('financeiro_full');
  return rows.map((row) => ({
    ...row,
    financeiro_categorias:
      row.categoria_nome || row.categoria_tipo
        ? { id: row.categoria_id, nome: row.categoria_nome as string, tipo: row.categoria_tipo as Categoria['tipo'] }
        : null,
  }));
};

export const getLancamentoById = async (id: string): Promise<LancamentoWithCategoria> => {
  const rows = await apiGet<LancamentoFullRow[]>('financeiro_full');
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error('Não foi possível carregar o lançamento: registro não encontrado.');
  return {
    ...row,
    financeiro_categorias:
      row.categoria_nome || row.categoria_tipo
        ? { id: row.categoria_id, nome: row.categoria_nome as string, tipo: row.categoria_tipo as Categoria['tipo'] }
        : null,
  };
};

export const createLancamento = async (payload: LancamentoPayload): Promise<Lancamento> =>
  apiPost<Lancamento>('financeiro_lancamentos', payload);

export const updateLancamento = async (id: string, payload: LancamentoUpdate): Promise<Lancamento> =>
  apiPatch<Lancamento>(`financeiro_lancamentos/${id}`, payload);

export const removeLancamento = async (id: string): Promise<void> => {
  await apiDelete(`financeiro_lancamentos/${id}`);
};

export const listCategorias = async (): Promise<Categoria[]> =>
  apiGet<Categoria[]>('financeiro_categorias?order=tipo');

export const getCategoriaById = async (id: string): Promise<Categoria> =>
  apiGetById<Categoria>('financeiro_categorias', id);

export const createCategoria = async (payload: CategoriaPayload): Promise<Categoria> =>
  apiPost<Categoria>('financeiro_categorias', payload);

export const updateCategoria = async (id: string, payload: CategoriaUpdate): Promise<Categoria> =>
  apiPatch<Categoria>(`financeiro_categorias/${id}`, payload);

export const removeCategoria = async (id: string): Promise<void> => {
  await apiDelete(`financeiro_categorias/${id}`);
};

export const getResumo = async (): Promise<ResumoFinanceiro> => {
  const rows = await apiGet<Pick<Lancamento, 'valor' | 'tipo' | 'status'>[]>('financeiro_lancamentos?eq_status=confirmado');

  const totais = rows.reduce(
    (resumo, lancamento) => {
      const valor = Number(lancamento.valor);
      if (lancamento.tipo === 'receita') resumo.receitas += valor;
      else resumo.despesas += valor;
      return resumo;
    },
    { receitas: 0, despesas: 0 },
  );

  return { ...totais, saldo: totais.receitas - totais.despesas };
};
