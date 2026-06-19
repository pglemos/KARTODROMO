import { supabase } from '../../lib/supabase';
import type {
  AjusteEstoquePayload,
  Estoque,
  Produto,
  ProdutoPayload,
  ProdutoUpdate,
  RegistrarVendaPayload,
} from './lanchonete.types';

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

export const listProdutos = async (): Promise<Produto[]> => {
  const { data, error } = await supabase
    .from('lanchonete_produtos')
    .select('id, nome, sku, categoria, preco, ativo')
    .order('nome');

  if (error) {
    throw queryError('Não foi possível carregar os produtos', error.message);
  }

  return (data ?? []) as Produto[];
};

export const getProdutoById = async (id: string): Promise<Produto> => {
  const { data, error } = await supabase
    .from('lanchonete_produtos')
    .select('id, nome, sku, categoria, preco, ativo')
    .eq('id', id)
    .single();

  if (error) {
    throw queryError('Não foi possível carregar o produto', error.message);
  }

  return data as Produto;
};

export const createProduto = async (payload: ProdutoPayload): Promise<Produto> => {
  const { data, error } = await supabase
    .from('lanchonete_produtos')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível criar o produto', error.message);
  }

  return data as Produto;
};

export const updateProduto = async (
  id: string,
  payload: ProdutoUpdate,
): Promise<Produto> => {
  const { data, error } = await supabase
    .from('lanchonete_produtos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível atualizar o produto', error.message);
  }

  return data as Produto;
};

export const removeProduto = async (id: string): Promise<void> => {
  const { error } = await supabase.from('lanchonete_produtos').delete().eq('id', id);

  if (error) {
    throw queryError('Não foi possível excluir o produto', error.message);
  }
};

export const listEstoque = async (): Promise<Estoque[]> => {
  const { data, error } = await supabase
    .from('lanchonete_estoque')
    .select('id, produto_id, quantidade, min_alerta')
    .order('produto_id');

  if (error) {
    throw queryError('Não foi possível carregar o estoque', error.message);
  }

  return (data ?? []) as Estoque[];
};

export const ajustarEstoque = async (payload: AjusteEstoquePayload): Promise<Estoque> => {
  const { data, error } = await supabase
    .from('lanchonete_estoque')
    .upsert(payload, { onConflict: 'produto_id' })
    .select()
    .single();

  if (error) {
    throw queryError('Não foi possível ajustar o estoque', error.message);
  }

  return data as Estoque;
};

/**
 * Registra uma venda de forma ATÔMICA via função RPC do Postgres
 * (public.registrar_venda). A função trava o estoque (FOR UPDATE),
 * calcula o total no servidor e valida o papel do usuário —
 * tudo em uma única transação. Retorna o id da venda criada.
 */
export const registrarVenda = async (payload: RegistrarVendaPayload): Promise<string> => {
  const itens = payload.itens.map((item) => ({
    produto_id: item.produto_id,
    quantidade: item.quantidade,
  }));

  const { data, error } = await supabase.rpc('registrar_venda', {
    p_pagamento: payload.pagamento,
    p_itens: itens,
  });

  if (error) {
    throw queryError('Não foi possível registrar a venda', error.message);
  }

  return data as string;
};
