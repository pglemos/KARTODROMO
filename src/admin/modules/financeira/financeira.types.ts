export type FinanceiroTipo = 'receita' | 'despesa';

export type LancamentoStatus = 'previsto' | 'confirmado' | 'cancelado';

export type Categoria = {
  id: string;
  nome: string;
  tipo: FinanceiroTipo;
};

export type Lancamento = {
  id: string;
  descricao: string;
  valor: number;
  tipo: FinanceiroTipo;
  categoria_id: string;
  data: string;
  origem: string | null;
  origem_ref: string | null;
  status: LancamentoStatus;
  created_at: string;
};

export type LancamentoWithCategoria = Lancamento & {
  financeiro_categorias: Pick<Categoria, 'id' | 'nome' | 'tipo'> | null;
};

export type CategoriaPayload = Omit<Categoria, 'id'>;
export type CategoriaUpdate = Partial<CategoriaPayload>;
export type LancamentoPayload = Omit<Lancamento, 'id' | 'created_at'>;
export type LancamentoUpdate = Partial<LancamentoPayload>;

export type ResumoFinanceiro = {
  receitas: number;
  despesas: number;
  saldo: number;
};
