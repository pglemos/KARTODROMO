import { useMemo, useState, type FormEvent } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/useToast';
import { ArquivoCampo } from './ArquivoCampo';
import { badgeContrato, dataBr, diasAte, hojeIso, inputClassName, moeda, periodosSobrepoem, statusLabel } from './formatacao';
import { patrocinadoresApi, recorrenciaLabel } from './patrocinadores.api';
import { Selo } from './Selo';
import type { Cobranca, Contrato, Empresa, Espaco, StatusContrato } from './patrocinadores.types';

type Props = { cobrancas: Cobranca[]; contratos: Contrato[]; empresas: Empresa[]; espacos: Espaco[]; onChanged: () => Promise<void> };

const filtros: { valor: 'todos' | StatusContrato; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'rascunho', rotulo: 'Rascunhos' },
  { valor: 'encerrado', rotulo: 'Encerrados' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
];

const vazio = (empresaId: string): Partial<Contrato> => ({
  empresa_id: empresaId,
  espaco_id: null,
  titulo: '',
  status: 'ativo',
  valor: 0,
  recorrencia: 'mensal',
  dia_vencimento: 10,
  data_inicio: hojeIso(),
  data_fim: null,
  renovacao_automatica: false,
});

export function ContratosTab({ cobrancas, contratos, empresas, espacos, onChanged }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [filtro, setFiltro] = useState<'todos' | StatusContrato>('todos');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Partial<Contrato> | null>(null);
  const [excluindo, setExcluindo] = useState<Contrato | null>(null);
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter(
      (c) => (filtro === 'todos' || c.status === filtro) && (!termo || [c.titulo, c.empresa_nome, c.espaco_nome].some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [busca, contratos, filtro]);

  const set = (campo: keyof Contrato, valor: unknown) => setEditando((atual) => ({ ...atual, [campo]: valor }));

  const escolherEspaco = (espacoId: string) => {
    const espaco = espacos.find((e) => e.id === espacoId);
    setEditando((atual) => ({
      ...atual,
      espaco_id: espacoId || null,
      valor: atual?.valor ? atual.valor : (espaco?.valor_tabela ?? 0),
      titulo: atual?.titulo ? atual.titulo : espaco ? `Publicidade — ${espaco.nome}` : '',
    }));
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!editando) return;
    if (!editando.empresa_id) return toastError('Escolha a empresa. Cadastre na aba Empresas se ainda não existir.');
    if (!editando.titulo?.trim()) return toastError('Informe um título para o contrato');
    if (!editando.data_inicio) return toastError('Informe a data de início');
    if (editando.data_fim && editando.data_fim < editando.data_inicio) return toastError('A data final não pode ser antes do início');
    if (editando.status === 'ativo' && editando.espaco_id) {
      const conflito = contratos.find(
        (c) => c.id !== editando.id && c.espaco_id === editando.espaco_id && c.status === 'ativo' && periodosSobrepoem({ data_inicio: editando.data_inicio as string, data_fim: editando.data_fim ?? null }, c),
      );
      if (conflito) return toastError(`Esse espaço já está contratado por ${conflito.empresa_nome} de ${dataBr(conflito.data_inicio)} a ${conflito.data_fim ? dataBr(conflito.data_fim) : 'prazo indeterminado'}.`);
    }
    setSalvando(true);
    try {
      const { id, empresa_nome, espaco_nome, espaco_tipo, ...dados } = editando as Contrato;
      void empresa_nome; void espaco_nome; void espaco_tipo;
      await patrocinadoresApi.salvar('patro_contratos', id ?? null, {
        ...dados,
        titulo: dados.titulo.trim(),
        valor: Number(dados.valor) || 0,
        dia_vencimento: Math.min(Math.max(Number(dados.dia_vencimento) || 10, 1), 28),
        data_fim: dados.data_fim || null,
        updated_at: new Date().toISOString(),
      });
      toastSuccess(id ? 'Contrato atualizado' : 'Contrato criado. Use "Gerar cobranças" para programar as parcelas.');
      setEditando(null);
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  const gerar = async (contrato: Contrato) => {
    try {
      const resultado = await patrocinadoresApi.gerarCobrancas(contrato.id);
      toastSuccess(resultado.geradas ? `${resultado.geradas} cobrança(s) gerada(s)` : 'Todas as cobranças já estavam geradas');
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível gerar as cobranças');
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    try {
      await patrocinadoresApi.remover('patro_contratos', excluindo.id);
      toastSuccess('Contrato excluído');
      setExcluindo(null);
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível excluir');
    }
  };

  const parcelasDo = (id: string) => cobrancas.filter((c) => c.contrato_id === id && c.status !== 'cancelado').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kib-texto-3" />
          <input className={`${inputClassName} pl-9`} placeholder="Buscar por empresa, espaço ou título" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button
          onClick={() => (empresas.length ? setEditando(vazio(empresas[0].id)) : toastError('Cadastre uma empresa antes de criar o contrato (aba Empresas).'))}
        >
          <Plus size={16} /> Novo contrato
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar contratos por status">
        {filtros.map((f) => (
          <button key={f.valor} type="button" onClick={() => setFiltro(f.valor)} aria-pressed={filtro === f.valor}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filtro === f.valor ? 'border-kib-acao bg-kib-acao text-kib-sobre-acao' : 'border-kib-borda text-kib-texto-2 hover:bg-kib-campo'}`}>
            {f.rotulo}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <Card className="p-8 text-center text-sm text-kib-texto-2">
          {contratos.length === 0 ? 'Nenhum contrato ainda. Crie o primeiro para começar a controlar cobranças.' : 'Nenhum contrato com esse filtro.'}
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((contrato) => {
            const dias = contrato.data_fim ? diasAte(contrato.data_fim) : null;
            const vencendo = contrato.status === 'ativo' && dias !== null && dias >= 0 && dias <= 30;
            return (
              <Card key={contrato.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-kib-texto">{contrato.empresa_nome ?? 'Empresa removida'}</h3>
                    <p className="truncate text-xs text-kib-texto-2">{contrato.titulo}</p>
                  </div>
                  <Selo classe={badgeContrato[contrato.status]}>{statusLabel[contrato.status]}</Selo>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div><dt className="text-kib-texto-3">Espaço</dt><dd className="font-bold text-kib-texto">{contrato.espaco_nome ?? 'Não vinculado'}</dd></div>
                  <div><dt className="text-kib-texto-3">Valor</dt><dd className="font-bold text-kib-texto">{moeda(contrato.valor)} · {recorrenciaLabel[contrato.recorrencia]}</dd></div>
                  <div><dt className="text-kib-texto-3">Vigência</dt><dd className="font-bold text-kib-texto">{dataBr(contrato.data_inicio)} a {contrato.data_fim ? dataBr(contrato.data_fim) : 'indeterminado'}</dd></div>
                  <div><dt className="text-kib-texto-3">Vencimento</dt><dd className="font-bold text-kib-texto">Todo dia {contrato.dia_vencimento} · {parcelasDo(contrato.id)} parcela(s)</dd></div>
                </dl>
                {vencendo && <p className="rounded-lg bg-kib-aviso-fundo px-3 py-2 text-xs font-bold text-kib-aviso">Vence em {dias} dia(s){contrato.renovacao_automatica ? ' — renovação automática marcada' : ' — combine a renovação'}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-kib-borda pt-3 text-xs font-bold">
                  <span className="flex gap-3">
                    {contrato.contrato_arquivo_id && <a className="inline-flex items-center gap-1 text-kib-texto-2 hover:text-kib-acao" href={`/api/admin/patrocinadores/arquivos/${contrato.contrato_arquivo_id}?download=1`} target="_blank" rel="noreferrer"><FileText size={13} /> Contrato</a>}
                    {contrato.status !== 'cancelado' && <button type="button" className="text-kib-acao hover:underline" onClick={() => void gerar(contrato)}>Gerar cobranças</button>}
                  </span>
                  <span className="flex gap-3">
                    <button type="button" className="text-kib-acao hover:underline" onClick={() => setEditando(contrato)}>Editar</button>
                    <button type="button" className="text-kib-perigo hover:underline" onClick={() => setExcluindo(contrato)}>Excluir</button>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={editando !== null}
        title={editando?.id ? 'Editar contrato' : 'Novo contrato'}
        onClose={() => setEditando(null)}
        footer={<><Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" form="form-contrato" loading={salvando}>Salvar</Button></>}
      >
        {editando && (
          <form id="form-contrato" onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            <FormField label="Empresa *">
              <select className={inputClassName} value={editando.empresa_id ?? ''} onChange={(e) => set('empresa_id', e.target.value)} required>
                {empresas.filter((e) => e.ativo || e.id === editando.empresa_id).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </FormField>
            <FormField label="Espaço (outdoor, pódio...)" hint="Preenche valor e título sugeridos">
              <select className={inputClassName} value={editando.espaco_id ?? ''} onChange={(e) => escolherEspaco(e.target.value)}>
                <option value="">Sem espaço específico</option>
                {espacos.filter((e) => e.ativo || e.id === editando.espaco_id).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </FormField>
            <div className="sm:col-span-2"><FormField label="Título *"><input className={inputClassName} value={editando.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Outdoor reta principal — 2026" required /></FormField></div>
            <FormField label="Valor (R$) *"><input type="number" min={0} step="0.01" className={inputClassName} value={editando.valor ?? 0} onChange={(e) => set('valor', e.target.value)} required /></FormField>
            <FormField label="Recorrência" hint="O valor é cobrado a cada período">
              <select className={inputClassName} value={editando.recorrencia} onChange={(e) => set('recorrencia', e.target.value)}>
                {Object.entries(recorrenciaLabel).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </FormField>
            <FormField label="Início *"><input type="date" className={inputClassName} value={editando.data_inicio ?? ''} onChange={(e) => set('data_inicio', e.target.value)} required /></FormField>
            <FormField label="Fim" hint="Vazio = sem data final"><input type="date" className={inputClassName} value={editando.data_fim ?? ''} onChange={(e) => set('data_fim', e.target.value || null)} /></FormField>
            <FormField label="Dia do vencimento" hint="De 1 a 28"><input type="number" min={1} max={28} className={inputClassName} value={editando.dia_vencimento ?? 10} onChange={(e) => set('dia_vencimento', e.target.value)} /></FormField>
            <FormField label="Situação">
              <select className={inputClassName} value={editando.status} onChange={(e) => set('status', e.target.value)}>
                <option value="rascunho">Rascunho (em negociação)</option>
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </FormField>
            <label className="flex items-center gap-2 text-sm text-kib-texto sm:col-span-2">
              <input type="checkbox" checked={editando.renovacao_automatica ?? false} onChange={(e) => set('renovacao_automatica', e.target.checked)} /> Renovação automática (apenas lembrete no resumo)
            </label>
            <ArquivoCampo label="Contrato assinado" categoria="contrato" tipo="documento" valor={editando.contrato_arquivo_id ?? null} onChange={(id) => set('contrato_arquivo_id', id)} onErro={toastError} ajuda="PDF ou DOCX, até 8 MB" />
            <ArquivoCampo label="Arte / imagem da marca" categoria="arte" tipo="imagem" valor={editando.arte_arquivo_id ?? null} onChange={(id) => set('arte_arquivo_id', id)} onErro={toastError} ajuda="Arte que vai no outdoor ou pódio" />
            <div className="sm:col-span-2"><FormField label="Observações"><textarea rows={3} className={inputClassName} value={editando.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></FormField></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog isOpen={excluindo !== null} title="Excluir contrato" message={`Excluir "${excluindo?.titulo}" e todas as cobranças dele? Para manter o histórico, mude a situação para Encerrado ou Cancelado.`} onClose={() => setExcluindo(null)} onConfirm={() => void excluir()} />
    </div>
  );
}
