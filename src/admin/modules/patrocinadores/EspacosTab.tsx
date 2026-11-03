import { useState, type FormEvent } from 'react';
import { ImageIcon, MapPin, Plus, Ruler } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/useToast';
import { ArquivoCampo } from './ArquivoCampo';
import { dataBr, inputClassName, moeda, tipoEspacoLabel, vigenteHoje } from './formatacao';
import { arquivoUrl, patrocinadoresApi } from './patrocinadores.api';
import type { Contrato, Espaco } from './patrocinadores.types';

type Props = { espacos: Espaco[]; contratos: Contrato[]; onChanged: () => Promise<void> };

const vazio = (): Partial<Espaco> => ({ nome: '', tipo: 'outdoor', valor_tabela: 0, ativo: true });

export function EspacosTab({ contratos, espacos, onChanged }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [editando, setEditando] = useState<Partial<Espaco> | null>(null);
  const [excluindo, setExcluindo] = useState<Espaco | null>(null);
  const [salvando, setSalvando] = useState(false);

  const set = (campo: keyof Espaco, valor: unknown) => setEditando((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!editando?.nome?.trim()) return toastError('Informe o nome do espaço');
    setSalvando(true);
    try {
      const { id, ...dados } = editando;
      await patrocinadoresApi.salvar('patro_espacos', id ?? null, { ...dados, nome: dados.nome?.trim(), valor_tabela: Number(dados.valor_tabela) || 0 });
      toastSuccess(id ? 'Espaço atualizado' : 'Espaço cadastrado');
      setEditando(null);
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    try {
      await patrocinadoresApi.remover('patro_espacos', excluindo.id);
      toastSuccess('Espaço excluído');
      setExcluindo(null);
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível excluir');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-kib-texto-2">Outdoors, placas, pódio e demais pontos de exposição de marca. O status Livre/Ocupado vem dos contratos ativos.</p>
        <Button onClick={() => setEditando(vazio())}><Plus size={16} /> Novo espaço</Button>
      </div>

      {espacos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-kib-texto-2">Nenhum espaço cadastrado. Cadastre cada outdoor e o pódio para poder vendê-los.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {espacos.map((espaco) => {
            const ocupante = contratos.find((c) => c.espaco_id === espaco.id && vigenteHoje(c));
            return (
              <Card key={espaco.id} className={`overflow-hidden ${espaco.ativo ? '' : 'opacity-60'}`}>
                <div className="flex aspect-video items-center justify-center bg-kib-fundo text-kib-texto-3">
                  {espaco.foto_arquivo_id ? (
                    <img src={arquivoUrl(espaco.foto_arquivo_id)} alt={espaco.nome} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon size={32} />
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-kib-texto">{espaco.nome}</h3>
                      <p className="text-xs text-kib-texto-3">{tipoEspacoLabel[espaco.tipo]}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${ocupante ? 'border-kib-info/40 bg-kib-info-fundo text-kib-info' : 'border-kib-sucesso/40 bg-kib-sucesso-fundo text-kib-sucesso'}`}>
                      {ocupante ? 'Ocupado' : 'Livre'}
                    </span>
                  </div>
                  {espaco.localizacao && <p className="flex items-center gap-1.5 text-xs text-kib-texto-2"><MapPin size={12} /> {espaco.localizacao}</p>}
                  {espaco.dimensoes && <p className="flex items-center gap-1.5 text-xs text-kib-texto-2"><Ruler size={12} /> {espaco.dimensoes}</p>}
                  <p className="text-xs text-kib-texto-2">
                    {ocupante ? `${ocupante.empresa_nome} até ${ocupante.data_fim ? dataBr(ocupante.data_fim) : 'prazo indeterminado'}` : 'Disponível para contrato'}
                  </p>
                  <div className="flex items-center justify-between border-t border-kib-borda pt-3 text-xs">
                    <span className="font-bold text-kib-texto">{espaco.valor_tabela ? `${moeda(espaco.valor_tabela)} (tabela)` : 'Sem valor de tabela'}</span>
                    <span className="flex gap-3 font-bold">
                      <button type="button" className="text-kib-acao hover:underline" onClick={() => setEditando(espaco)}>Editar</button>
                      <button type="button" className="text-kib-perigo hover:underline" onClick={() => setExcluindo(espaco)}>Excluir</button>
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={editando !== null}
        title={editando?.id ? 'Editar espaço' : 'Novo espaço'}
        onClose={() => setEditando(null)}
        footer={<><Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" form="form-espaco" loading={salvando}>Salvar</Button></>}
      >
        {editando && (
          <form id="form-espaco" onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ArquivoCampo label="Foto do espaço" categoria="foto" tipo="imagem" valor={editando.foto_arquivo_id ?? null}
                onChange={(id) => set('foto_arquivo_id', id)} onErro={toastError} ajuda="Foto do outdoor ou do pódio" />
            </div>
            <FormField label="Nome *"><input className={inputClassName} value={editando.nome ?? ''} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Outdoor da reta dos boxes" required /></FormField>
            <FormField label="Tipo">
              <select className={inputClassName} value={editando.tipo} onChange={(e) => set('tipo', e.target.value)}>
                {Object.entries(tipoEspacoLabel).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </FormField>
            <FormField label="Localização"><input className={inputClassName} value={editando.localizacao ?? ''} onChange={(e) => set('localizacao', e.target.value)} placeholder="Onde fica" /></FormField>
            <FormField label="Medidas"><input className={inputClassName} value={editando.dimensoes ?? ''} onChange={(e) => set('dimensoes', e.target.value)} placeholder="Ex.: 6 x 3 m" /></FormField>
            <FormField label="Valor de tabela (R$)" hint="Sugestão ao criar contrato"><input type="number" min={0} step="0.01" className={inputClassName} value={editando.valor_tabela ?? 0} onChange={(e) => set('valor_tabela', e.target.value)} /></FormField>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-kib-texto"><input type="checkbox" checked={editando.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Espaço disponível para venda</label>
            <div className="sm:col-span-2"><FormField label="Descrição"><textarea rows={3} className={inputClassName} value={editando.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} /></FormField></div>
          </form>
        )}
      </Modal>

      <ConfirmDialog isOpen={excluindo !== null} title="Excluir espaço" message={`Excluir "${excluindo?.nome}"? Os contratos continuam, mas ficam sem espaço vinculado.`} onClose={() => setExcluindo(null)} onConfirm={() => void excluir()} />
    </div>
  );
}
