import {
  Minus,
  Plus,
  ShoppingCart,
  UtensilsCrossed,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/useToast';
import {
  ajustarEstoque,
  createProduto,
  listEstoque,
  listProdutos,
  registrarVenda,
  removeProduto,
  updateProduto,
} from './lanchonete.api';
import type {
  Estoque,
  Pagamento,
  Produto,
  ProdutoPayload,
} from './lanchonete.types';

type Tab = 'pdv' | 'produtos' | 'estoque';

type CartItem = {
  produto: Produto;
  quantidade: number;
};

type ProdutoFormState = {
  nome: string;
  sku: string;
  categoria: string;
  preco: string;
  ativo: boolean;
};

type ProdutoFormErrors = Partial<Record<keyof ProdutoFormState, string>>;

type EstoqueRow = {
  id: string;
  produto_id: string;
  produto: Produto;
  quantidade: number;
  min_alerta: number;
};

type EstoqueFormState = {
  quantidade: string;
  min_alerta: string;
};

type EstoqueFormErrors = Partial<Record<keyof EstoqueFormState, string>>;

const emptyProdutoForm: ProdutoFormState = {
  nome: '',
  sku: '',
  categoria: '',
  preco: '0',
  ativo: true,
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const quantityFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

const paymentLabels: Record<Pagamento, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
  cortesia: 'Cortesia',
};

const tabs: readonly { id: Tab; label: string }[] = [
  { id: 'pdv', label: 'PDV' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'estoque', label: 'Estoque' },
];

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const validateProduto = (form: ProdutoFormState): ProdutoFormErrors => {
  const errors: ProdutoFormErrors = {};
  const price = Number(form.preco);

  if (!form.nome.trim()) errors.nome = 'Informe o nome do produto.';
  if (!form.sku.trim()) errors.sku = 'Informe o SKU.';
  if (!form.categoria.trim()) errors.categoria = 'Informe a categoria.';
  if (!Number.isFinite(price) || price < 0) errors.preco = 'Informe um preço válido.';

  return errors;
};

const validateEstoque = (form: EstoqueFormState): EstoqueFormErrors => {
  const errors: EstoqueFormErrors = {};
  const quantity = Number(form.quantidade);
  const minimum = Number(form.min_alerta);

  if (!Number.isFinite(quantity) || quantity < 0) {
    errors.quantidade = 'Informe uma quantidade válida.';
  }
  if (!Number.isFinite(minimum) || minimum < 0) {
    errors.min_alerta = 'Informe um alerta mínimo válido.';
  }

  return errors;
};

export const LanchonetePage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('pdv');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<Pagamento>('dinheiro');
  const [finishingSale, setFinishingSale] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deletingProduto, setDeletingProduto] = useState<Produto | null>(null);
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
  const [produtoForm, setProdutoForm] = useState<ProdutoFormState>(emptyProdutoForm);
  const [produtoErrors, setProdutoErrors] = useState<ProdutoFormErrors>({});
  const [savingProduto, setSavingProduto] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingEstoque, setEditingEstoque] = useState<EstoqueRow | null>(null);
  const [estoqueForm, setEstoqueForm] = useState<EstoqueFormState>({
    quantidade: '0',
    min_alerta: '0',
  });
  const [estoqueErrors, setEstoqueErrors] = useState<EstoqueFormErrors>({});
  const [savingEstoque, setSavingEstoque] = useState(false);

  const canWrite =
    canAccess(role, 'lanchonete') && ['owner', 'admin', 'lanchonete'].includes(role);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productsData, stockData] = await Promise.all([listProdutos(), listEstoque()]);
      setProdutos(productsData);
      setEstoque(stockData);
      setCart((current) =>
        current.flatMap((item) => {
          const product = productsData.find((candidate) => candidate.id === item.produto.id);
          return product?.ativo ? [{ ...item, produto: product }] : [];
        }),
      );
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stockByProduct = useMemo(
    () => new Map(estoque.map((item) => [item.produto_id, Number(item.quantidade)])),
    [estoque],
  );

  const activeProducts = useMemo(
    () => produtos.filter((produto) => produto.ativo),
    [produtos],
  );

  const stockRows = useMemo<EstoqueRow[]>(
    () =>
      produtos.map((produto) => {
        const stock = estoque.find((item) => item.produto_id === produto.id);
        return {
          id: stock?.id ?? `produto-${produto.id}`,
          produto_id: produto.id,
          produto,
          quantidade: Number(stock?.quantidade ?? 0),
          min_alerta: Number(stock?.min_alerta ?? 0),
        };
      }),
    [estoque, produtos],
  );

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + Number(item.produto.preco) * item.quantidade,
        0,
      ),
    [cart],
  );

  const addToCart = (produto: Produto) => {
    if (!canWrite) return;
    const available = stockByProduct.get(produto.id) ?? 0;
    const existing = cart.find((item) => item.produto.id === produto.id);
    const nextQuantity = (existing?.quantidade ?? 0) + 1;
    if (nextQuantity > available) {
      toast.error('Quantidade indisponível em estoque.');
      return;
    }
    setCart((current) =>
      existing
        ? current.map((item) =>
            item.produto.id === produto.id ? { ...item, quantidade: nextQuantity } : item,
          )
        : [...current, { produto, quantidade: 1 }],
    );
  };

  const changeCartQuantity = (productId: string, delta: number) => {
    const existing = cart.find((item) => item.produto.id === productId);
    if (!existing) return;
    const nextQuantity = existing.quantidade + delta;
    const available = stockByProduct.get(productId) ?? 0;
    if (nextQuantity > available) {
      toast.error('Quantidade indisponível em estoque.');
      return;
    }
    setCart((current) =>
      nextQuantity <= 0
        ? current.filter((item) => item.produto.id !== productId)
        : current.map((item) =>
            item.produto.id === productId ? { ...item, quantidade: nextQuantity } : item,
          ),
    );
  };

  const handleFinishSale = async () => {
    if (!canWrite || cart.length === 0) return;
    setFinishingSale(true);
    try {
      await registrarVenda({
        pagamento: payment,
        itens: cart.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
        })),
      });
      toast.success(`Venda de ${currencyFormatter.format(cartTotal)} finalizada.`);
      setCart([]);
      setPayment('dinheiro');
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setFinishingSale(false);
    }
  };

  const productColumns = useMemo<readonly DataTableColumn<Produto>[]>(
    () => [
      { key: 'nome', label: 'Nome' },
      { key: 'sku', label: 'SKU' },
      { key: 'categoria', label: 'Categoria' },
      {
        key: 'preco',
        label: 'Preço',
        render: (produto) => currencyFormatter.format(Number(produto.preco)),
      },
      {
        key: 'ativo',
        label: 'Ativo',
        render: (produto) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
              produto.ativo
                ? 'border-brand-800 bg-brand-950 text-brand-100'
                : 'border-zinc-700 bg-zinc-800 text-zinc-300'
            }`}
          >
            {produto.ativo ? 'Sim' : 'Não'}
          </span>
        ),
      },
    ],
    [],
  );

  const stockColumns = useMemo<readonly DataTableColumn<EstoqueRow>[]>(
    () => [
      {
        key: 'produto',
        label: 'Produto',
        render: (row) => (
          <div className={row.quantidade <= row.min_alerta ? 'text-red-300' : ''}>
            <span className="font-semibold">{row.produto.nome}</span>
            {row.quantidade <= row.min_alerta ? (
              <span className="ml-2 rounded-full bg-red-950 px-2 py-1 text-xs font-bold text-red-200">
                Estoque baixo
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'quantidade',
        label: 'Quantidade',
        render: (row) => (
          <span className={row.quantidade <= row.min_alerta ? 'font-bold text-red-300' : ''}>
            {quantityFormatter.format(row.quantidade)}
          </span>
        ),
      },
      {
        key: 'min_alerta',
        label: 'Alerta mínimo',
        render: (row) => quantityFormatter.format(row.min_alerta),
      },
    ],
    [],
  );

  const openCreateProduto = () => {
    setEditingProduto(null);
    setProdutoForm(emptyProdutoForm);
    setProdutoErrors({});
    setIsProdutoModalOpen(true);
  };

  const openEditProduto = (produto: Produto) => {
    setEditingProduto(produto);
    setProdutoForm({
      nome: produto.nome,
      sku: produto.sku,
      categoria: produto.categoria,
      preco: String(produto.preco),
      ativo: produto.ativo,
    });
    setProdutoErrors({});
    setIsProdutoModalOpen(true);
  };

  const updateProdutoForm = <K extends keyof ProdutoFormState>(
    field: K,
    value: ProdutoFormState[K],
  ) => {
    setProdutoForm((current) => ({ ...current, [field]: value }));
    setProdutoErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleProdutoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateProduto(produtoForm);
    if (Object.keys(errors).length > 0) {
      setProdutoErrors(errors);
      return;
    }

    const payload: ProdutoPayload = {
      nome: produtoForm.nome.trim(),
      sku: produtoForm.sku.trim(),
      categoria: produtoForm.categoria.trim(),
      preco: Number(produtoForm.preco),
      ativo: produtoForm.ativo,
    };
    setSavingProduto(true);
    try {
      if (editingProduto) {
        await updateProduto(editingProduto.id, payload);
        toast.success('Produto atualizado com sucesso.');
      } else {
        await createProduto(payload);
        toast.success('Produto criado com sucesso.');
      }
      setIsProdutoModalOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingProduto(false);
    }
  };

  const handleDeleteProduto = async () => {
    if (!deletingProduto) return;
    setDeleting(true);
    try {
      await removeProduto(deletingProduto.id);
      toast.success('Produto excluído com sucesso.');
      setDeletingProduto(null);
      setCart((current) =>
        current.filter((item) => item.produto.id !== deletingProduto.id),
      );
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const openEstoqueModal = (row: EstoqueRow) => {
    setEditingEstoque(row);
    setEstoqueForm({
      quantidade: String(row.quantidade),
      min_alerta: String(row.min_alerta),
    });
    setEstoqueErrors({});
  };

  const handleEstoqueSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEstoque) return;
    const errors = validateEstoque(estoqueForm);
    if (Object.keys(errors).length > 0) {
      setEstoqueErrors(errors);
      return;
    }

    setSavingEstoque(true);
    try {
      await ajustarEstoque({
        produto_id: editingEstoque.produto_id,
        quantidade: Number(estoqueForm.quantidade),
        min_alerta: Number(estoqueForm.min_alerta),
      });
      toast.success('Estoque atualizado com sucesso.');
      setEditingEstoque(null);
      await loadData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingEstoque(false);
    }
  };

  return (
    <section>
      <PageHeader
        subtitle="Venda no balcão, cadastro de produtos e controle de estoque."
        title="Lanchonete"
      />

      <div className="mt-7 flex gap-2 overflow-x-auto border-b border-zinc-800" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? 'border-brand-400 text-brand-200'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {activeTab === 'pdv' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <h2 className="text-lg font-black text-white">Produtos disponíveis</h2>
              {loadError ? (
                <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 p-5 text-red-200">
                  <p>{loadError}</p>
                  <Button className="mt-4" onClick={() => void loadData()} variant="ghost">
                    Tentar novamente
                  </Button>
                </div>
              ) : loading ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div
                      className="h-28 animate-pulse rounded-xl bg-zinc-800"
                      key={index}
                    />
                  ))}
                </div>
              ) : activeProducts.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                  Nenhum produto ativo cadastrado.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeProducts.map((produto) => {
                    const available = stockByProduct.get(produto.id) ?? 0;
                    return (
                      <button
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-brand-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canWrite || available <= 0}
                        key={produto.id}
                        onClick={() => addToCart(produto)}
                        type="button"
                      >
                        <span className="block text-xs font-bold uppercase tracking-wide text-zinc-400">
                          {produto.categoria}
                        </span>
                        <span className="mt-1 block font-bold text-white">{produto.nome}</span>
                        <span className="mt-3 flex items-end justify-between gap-2">
                          <span className="text-lg font-black text-brand-300">
                            {currencyFormatter.format(Number(produto.preco))}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {available > 0
                              ? `${quantityFormatter.format(available)} em estoque`
                              : 'Sem estoque'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="h-fit rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <ShoppingCart className="text-brand-300" size={22} />
                <h2 className="text-lg font-black text-white">Carrinho</h2>
              </div>
              {cart.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">
                  <UtensilsCrossed className="mx-auto mb-3" size={26} />
                  Clique em um produto para adicionar.
                </div>
              ) : (
                <div className="mt-4 divide-y divide-zinc-800">
                  {cart.map((item) => (
                    <div className="py-4" key={item.produto.id}>
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-white">{item.produto.nome}</span>
                        <span className="text-sm font-bold text-zinc-200">
                          {currencyFormatter.format(
                            Number(item.produto.preco) * item.quantidade,
                          )}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          aria-label={`Diminuir ${item.produto.nome}`}
                          className="h-9 px-3"
                          onClick={() => changeCartQuantity(item.produto.id, -1)}
                          variant="ghost"
                        >
                          <Minus size={15} />
                        </Button>
                        <span className="min-w-8 text-center font-bold text-white">
                          {item.quantidade}
                        </span>
                        <Button
                          aria-label={`Aumentar ${item.produto.nome}`}
                          className="h-9 px-3"
                          onClick={() => changeCartQuantity(item.produto.id, 1)}
                          variant="ghost"
                        >
                          <Plus size={15} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-zinc-800 pt-5">
                <FormField htmlFor="pdv-pagamento" label="Pagamento">
                  <select
                    className={inputClassName}
                    disabled={!canWrite}
                    id="pdv-pagamento"
                    onChange={(event) => setPayment(event.target.value as Pagamento)}
                    value={payment}
                  >
                    {Object.entries(paymentLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="mt-5 flex items-center justify-between text-white">
                  <span className="font-bold">Total</span>
                  <strong className="text-2xl text-brand-300">
                    {currencyFormatter.format(cartTotal)}
                  </strong>
                </div>
                <Button
                  className="mt-5 w-full"
                  disabled={!canWrite || cart.length === 0}
                  loading={finishingSale}
                  onClick={() => void handleFinishSale()}
                >
                  Finalizar venda
                </Button>
                {!canWrite ? (
                  <p className="mt-3 text-center text-xs text-zinc-400">
                    Seu perfil possui acesso somente para leitura.
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {activeTab === 'produtos' ? (
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white">Produtos</h2>
                <p className="mt-1 text-sm text-zinc-400">Itens disponíveis para venda no PDV.</p>
              </div>
              {canWrite ? <Button onClick={openCreateProduto}>Novo produto</Button> : null}
            </div>
            <DataTable
              columns={productColumns}
              emptyLabel="Nenhum produto cadastrado."
              error={loadError}
              loading={loading}
              onDelete={canWrite ? setDeletingProduto : undefined}
              onEdit={canWrite ? openEditProduto : undefined}
              onRetry={() => void loadData()}
              rows={produtos}
            />
          </div>
        ) : null}

        {activeTab === 'estoque' ? (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-black text-white">Estoque</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Produtos no limite mínimo aparecem destacados em vermelho.
              </p>
            </div>
            <DataTable
              columns={stockColumns}
              emptyLabel="Nenhum produto disponível para controle de estoque."
              error={loadError}
              loading={loading}
              onEdit={canWrite ? openEstoqueModal : undefined}
              onRetry={() => void loadData()}
              rows={stockRows}
            />
          </div>
        ) : null}
      </div>

      <Modal
        footer={
          <>
            <Button
              disabled={savingProduto}
              onClick={() => setIsProdutoModalOpen(false)}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button form="produto-form" loading={savingProduto} type="submit">
              {editingProduto ? 'Salvar alterações' : 'Criar produto'}
            </Button>
          </>
        }
        isOpen={isProdutoModalOpen}
        onClose={savingProduto ? () => undefined : () => setIsProdutoModalOpen(false)}
        title={editingProduto ? 'Editar produto' : 'Novo produto'}
      >
        <form className="grid gap-5 md:grid-cols-2" id="produto-form" onSubmit={handleProdutoSubmit}>
          <div className="md:col-span-2">
            <FormField error={produtoErrors.nome} htmlFor="produto-nome" label="Nome">
              <input
                className={inputClassName}
                id="produto-nome"
                onChange={(event) => updateProdutoForm('nome', event.target.value)}
                required
                value={produtoForm.nome}
              />
            </FormField>
          </div>
          <FormField error={produtoErrors.sku} htmlFor="produto-sku" label="SKU">
            <input
              className={inputClassName}
              id="produto-sku"
              onChange={(event) => updateProdutoForm('sku', event.target.value)}
              required
              value={produtoForm.sku}
            />
          </FormField>
          <FormField
            error={produtoErrors.categoria}
            htmlFor="produto-categoria"
            label="Categoria"
          >
            <input
              className={inputClassName}
              id="produto-categoria"
              onChange={(event) => updateProdutoForm('categoria', event.target.value)}
              required
              value={produtoForm.categoria}
            />
          </FormField>
          <FormField error={produtoErrors.preco} htmlFor="produto-preco" label="Preço (R$)">
            <input
              className={inputClassName}
              id="produto-preco"
              min="0"
              onChange={(event) => updateProdutoForm('preco', event.target.value)}
              required
              step="0.01"
              type="number"
              value={produtoForm.preco}
            />
          </FormField>
          <FormField htmlFor="produto-ativo" label="Disponibilidade">
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200">
              <input
                checked={produtoForm.ativo}
                className="h-4 w-4 accent-brand-500"
                id="produto-ativo"
                onChange={(event) => updateProdutoForm('ativo', event.target.checked)}
                type="checkbox"
              />
              Produto ativo no PDV
            </label>
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingProduto)}
        loading={deleting}
        message={`O produto ${deletingProduto?.nome ?? ''} será excluído permanentemente.`}
        onClose={() => setDeletingProduto(null)}
        onConfirm={() => void handleDeleteProduto()}
        title="Excluir produto"
      />

      <Modal
        footer={
          <>
            <Button
              disabled={savingEstoque}
              onClick={() => setEditingEstoque(null)}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button form="estoque-form" loading={savingEstoque} type="submit">
              Salvar estoque
            </Button>
          </>
        }
        isOpen={Boolean(editingEstoque)}
        onClose={savingEstoque ? () => undefined : () => setEditingEstoque(null)}
        title={`Ajustar estoque${editingEstoque ? `: ${editingEstoque.produto.nome}` : ''}`}
      >
        <form className="grid gap-5 md:grid-cols-2" id="estoque-form" onSubmit={handleEstoqueSubmit}>
          <FormField
            error={estoqueErrors.quantidade}
            htmlFor="estoque-quantidade"
            label="Quantidade"
          >
            <input
              className={inputClassName}
              id="estoque-quantidade"
              min="0"
              onChange={(event) => {
                setEstoqueForm((current) => ({ ...current, quantidade: event.target.value }));
                setEstoqueErrors((current) => ({ ...current, quantidade: undefined }));
              }}
              required
              step="0.001"
              type="number"
              value={estoqueForm.quantidade}
            />
          </FormField>
          <FormField
            error={estoqueErrors.min_alerta}
            htmlFor="estoque-minimo"
            label="Alerta mínimo"
          >
            <input
              className={inputClassName}
              id="estoque-minimo"
              min="0"
              onChange={(event) => {
                setEstoqueForm((current) => ({ ...current, min_alerta: event.target.value }));
                setEstoqueErrors((current) => ({ ...current, min_alerta: undefined }));
              }}
              required
              step="0.001"
              type="number"
              value={estoqueForm.min_alerta}
            />
          </FormField>
        </form>
      </Modal>
    </section>
  );
};
