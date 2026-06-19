export type Pagamento = 'dinheiro' | 'cartao' | 'pix' | 'cortesia';

export type Produto = {
  id: string;
  nome: string;
  sku: string;
  categoria: string;
  preco: number;
  ativo: boolean;
};

export type Estoque = {
  id: string;
  produto_id: string;
  quantidade: number;
  min_alerta: number;
};

export type Venda = {
  id: string;
  total: number;
  pagamento: Pagamento;
  created_at: string;
};

export type VendaItem = {
  id: string;
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_unit: number;
  subtotal: number;
};

export type ProdutoPayload = Omit<Produto, 'id'>;
export type ProdutoUpdate = Partial<ProdutoPayload>;

export type AjusteEstoquePayload = Pick<Estoque, 'produto_id' | 'quantidade' | 'min_alerta'>;

export type RegistrarVendaItem = Pick<VendaItem, 'produto_id' | 'quantidade'>;

export type RegistrarVendaPayload = {
  pagamento: Pagamento;
  itens: readonly RegistrarVendaItem[];
};
