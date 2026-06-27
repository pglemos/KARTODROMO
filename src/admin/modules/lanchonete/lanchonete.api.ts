import { apiDelete, apiGet, apiGetById, apiPatch, apiPost, apiPut } from '../../lib/api-client';
import type {
  AjusteEstoquePayload,
  Estoque,
  Produto,
  ProdutoPayload,
  ProdutoUpdate,
  RegistrarVendaPayload,
} from './lanchonete.types';

export const listProdutos = async (): Promise<Produto[]> => apiGet<Produto[]>('lanchonete_produtos?order=nome');

export const getProdutoById = async (id: string): Promise<Produto> => apiGetById<Produto>('lanchonete_produtos', id);

export const createProduto = async (payload: ProdutoPayload): Promise<Produto> =>
  apiPost<Produto>('lanchonete_produtos', payload);

export const updateProduto = async (id: string, payload: ProdutoUpdate): Promise<Produto> =>
  apiPatch<Produto>(`lanchonete_produtos/${id}`, payload);

export const removeProduto = async (id: string): Promise<void> => {
  await apiDelete(`lanchonete_produtos/${id}`);
};

export const listEstoque = async (): Promise<Estoque[]> =>
  apiGet<Estoque[]>('lanchonete_estoque?order=produto_id');

export const ajustarEstoque = async (payload: AjusteEstoquePayload): Promise<Estoque> =>
  apiPut<Estoque>('lanchonete_estoque/upsert', payload);

/**
 * Registra uma venda de forma ATÔMICA via endpoint dedicado da API local
 * (rodando no SRVKART), que trava o estoque, calcula o total no servidor
 * e grava venda+itens em uma única transação SQLite. Retorna o id da venda.
 */
export const registrarVenda = async (payload: RegistrarVendaPayload): Promise<string> => {
  const itens = payload.itens.map((item) => ({
    produto_id: item.produto_id,
    quantidade: item.quantidade,
  }));

  const result = await apiPost<{ venda_id: string; total: number }>('registrar_venda', {
    pagamento: payload.pagamento,
    itens,
  });

  return result.venda_id;
};
