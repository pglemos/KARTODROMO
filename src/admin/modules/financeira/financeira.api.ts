import { supabase } from '../../lib/supabase';
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

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

const missingDataError = (operation: string): Error =>
  new Error(`${operation}: o banco de dados não retornou o registro.`);

export const listLancamentos = async (): Promise<LancamentoWithCategoria[]> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*, financeiro_categorias(id, nome, tipo)')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw queryError('Não foi possível carregar os lançamentos', error.message);
  }

  return (data ?? []) as LancamentoWithCategoria[];
};

export const getLancamentoById = async (
  id: string,
): Promise<LancamentoWithCategoria> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*, financeiro_categorias(id, nome, tipo)')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o lançamento', error.message);
  }
  if (!data) {
    throw missingDataError('Não foi possível carregar o lançamento');
  }

  return data as LancamentoWithCategoria;
};

export const createLancamento = async (
  payload: LancamentoPayload,
): Promise<Lancamento> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar o lançamento', error.message);
  }
  if (!data) {
    throw missingDataError('Não foi possível criar o lançamento');
  }

  return data as Lancamento;
};

export const updateLancamento = async (
  id: string,
  payload: LancamentoUpdate,
): Promise<Lancamento> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o lançamento', error.message);
  }
  if (!data) {
    throw missingDataError('Não foi possível atualizar o lançamento');
  }

  return data as Lancamento;
};

export const removeLancamento = async (id: string): Promise<void> => {
  const { error } = await supabase.from('financeiro_lancamentos').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir o lançamento', error.message);
  }
};

export const listCategorias = async (): Promise<Categoria[]> => {
  const { data, error } = await supabase
    .from('financeiro_categorias')
    .select('id, nome, tipo')
    .order('tipo')
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar as categorias', error.message);
  }

  return (data ?? []) as Categoria[];
};

export const getCategoriaById = async (id: string): Promise<Categoria> => {
  const { data, error } = await supabase
    .from('financeiro_categorias')
    .select('id, nome, tipo')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar a categoria', error.message);
  }
  if (!data) {
    throw missingDataError('Não foi possível carregar a categoria');
  }

  return data as Categoria;
};

export const createCategoria = async (payload: CategoriaPayload): Promise<Categoria> => {
  const { data, error } = await supabase
    .from('financeiro_categorias')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar a categoria', error.message);
  }
  if (!data) {
    throw missingDataError('Não foi possível criar a categoria');
  }

  return data as Categoria;
};

export const updateCategoria = async (
  id: string,
  payload: CategoriaUpdate,
): Promise<Categoria> => {
  const { data, error } = await supabase
    .from('financeiro_categorias')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar a categoria', error.message);
  }
  if (!data) {
    throw missingDataError('Não foi possível atualizar a categoria');
  }

  return data as Categoria;
};

export const removeCategoria = async (id: string): Promise<void> => {
  const { error } = await supabase.from('financeiro_categorias').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir a categoria', error.message);
  }
};

export const getResumo = async (): Promise<ResumoFinanceiro> => {
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('valor, tipo')
    .eq('status', 'confirmado');

  if (error) {
    throw queryError('Não foi possível carregar o resumo financeiro', error.message);
  }

  const totais = ((data ?? []) as Pick<Lancamento, 'valor' | 'tipo'>[]).reduce(
    (resumo, lancamento) => {
      const valor = Number(lancamento.valor);
      if (lancamento.tipo === 'receita') {
        resumo.receitas += valor;
      } else {
        resumo.despesas += valor;
      }
      return resumo;
    },
    { receitas: 0, despesas: 0 },
  );

  return {
    ...totais,
    saldo: totais.receitas - totais.despesas,
  };
};
