import { useMemo, useState, type FormEvent } from 'react';
import { Building2, Mail, Phone, Plus, Search } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/useToast';
import { ArquivoCampo } from './ArquivoCampo';
import { inputClassName, moeda, valorMensal, vigenteHoje } from './formatacao';
import { arquivoUrl, patrocinadoresApi } from './patrocinadores.api';
import type { Contrato, Empresa } from './patrocinadores.types';

type Props = { empresas: Empresa[]; contratos: Contrato[]; onChanged: () => Promise<void> };

const vazio = (): Partial<Empresa> => ({ nome: '', ativo: true });

export function EmpresasTab({ contratos, empresas, onChanged }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Partial<Empresa> | null>(null);
  const [excluindo, setExcluindo] = useState<Empresa | null>(null);
  const [salvando, setSalvando] = useState(false);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresas.filter((e) => !termo || [e.nome, e.razao_social, e.cnpj, e.contato_nome, e.segmento].some((v) => v?.toLowerCase().includes(termo)));
  }, [busca, empresas]);

  const resumoDa = (empresaId: string) => {
    const ativos = contratos.filter((c) => c.empresa_id === empresaId && vigenteHoje(c));
    return { quantidade: ativos.length, mensal: ativos.reduce((soma, c) => soma + valorMensal(c.valor, c.recorrencia), 0) };
  };

  const set = (campo: keyof Empresa, valor: unknown) => setEditando((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!editando?.nome?.trim()) return toastError('Informe o nome da empresa');
    setSalvando(true);
    try {
      const { id, ...dados } = editando;
      await patrocinadoresApi.salvar('patro_empresas', id ?? null, { ...dados, nome: dados.nome?.trim(), updated_at: new Date().toISOString() });
      toastSuccess(id ? 'Empresa atualizada' : 'Empresa cadastrada');
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
      await patrocinadoresApi.remover('patro_empresas', excluindo.id);
      toastSuccess('Empresa excluída');
      setExcluindo(null);
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível excluir');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kib-texto-3" />
          <input className={`${inputClassName} pl-9`} placeholder="Buscar por nome, CNPJ ou contato" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button onClick={() => setEditando(vazio())}>
          <Plus size={16} /> Nova empresa
        </Button>
      </div>

      {filtradas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-kib-texto-2">
          {empresas.length === 0 ? 'Nenhuma empresa cadastrada ainda. Comece cadastrando o primeiro patrocinador.' : 'Nenhuma empresa encontrada.'}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((empresa) => {
            const resumo = resumoDa(empresa.id);
            return (
              <Card key={empresa.id} className={`p-4 ${empresa.ativo ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-kib-borda bg-kib-fundo text-kib-texto-3">
                    {empresa.logo_arquivo_id ? (
                      <img src={arquivoUrl(empresa.logo_arquivo_id)} alt={`Logo ${empresa.nome}`} className="h-full w-full object-contain" />
                    ) : (
                      <Building2 size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-kib-texto">{empresa.nome}</h3>
                    <p className="truncate text-xs text-kib-texto-3">{empresa.segmento || empresa.razao_social || 'Sem segmento'}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-xs text-kib-texto-2">
                  {empresa.contato_nome && <dd>{empresa.contato_nome}</dd>}
                  {empresa.email && <dd className="flex items-center gap-1.5"><Mail size={12} /> {empresa.email}</dd>}
                  {empresa.telefone && <dd className="flex items-center gap-1.5"><Phone size={12} /> {empresa.telefone}</dd>}
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-kib-borda pt-3 text-xs">
                  <span className="text-kib-texto-2">
                    {resumo.quantidade ? `${resumo.quantidade} contrato(s) ativo(s) · ${moeda(resumo.mensal)}/mês` : 'Sem contrato ativo'}
                  </span>
                  <span className="flex gap-3 font-bold">
                    <button type="button" className="text-kib-acao hover:underline" onClick={() => setEditando(empresa)}>Editar</button>
                    <button type="button" className="text-kib-perigo hover:underline" onClick={() => setExcluindo(empresa)}>Excluir</button>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={editando !== null}
        title={editando?.id ? 'Editar empresa' : 'Nova empresa'}
        onClose={() => setEditando(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button type="submit" form="form-empresa" loading={salvando}>Salvar</Button>
          </>
        }
      >
        {editando && (
          <form id="form-empresa" onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ArquivoCampo label="Logo da empresa" categoria="logo" tipo="imagem" valor={editando.logo_arquivo_id ?? null}
                onChange={(id) => set('logo_arquivo_id', id)} onErro={toastError} ajuda="PNG, JPG ou WEBP" />
            </div>
            <FormField label="Nome da marca *"><input className={inputClassName} value={editando.nome ?? ''} onChange={(e) => set('nome', e.target.value)} required /></FormField>
            <FormField label="Razão social"><input className={inputClassName} value={editando.razao_social ?? ''} onChange={(e) => set('razao_social', e.target.value)} /></FormField>
            <FormField label="CNPJ"><input className={inputClassName} value={editando.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" /></FormField>
            <FormField label="Segmento"><input className={inputClassName} value={editando.segmento ?? ''} onChange={(e) => set('segmento', e.target.value)} placeholder="Ex.: autopeças, bebidas" /></FormField>
            <FormField label="Pessoa de contato"><input className={inputClassName} value={editando.contato_nome ?? ''} onChange={(e) => set('contato_nome', e.target.value)} /></FormField>
            <FormField label="Telefone / WhatsApp"><input className={inputClassName} value={editando.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} /></FormField>
            <FormField label="E-mail"><input type="email" className={inputClassName} value={editando.email ?? ''} onChange={(e) => set('email', e.target.value)} /></FormField>
            <FormField label="Site"><input className={inputClassName} value={editando.site ?? ''} onChange={(e) => set('site', e.target.value)} /></FormField>
            <div className="sm:col-span-2"><FormField label="Endereço"><input className={inputClassName} value={editando.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} /></FormField></div>
            <div className="sm:col-span-2"><FormField label="Observações"><textarea rows={3} className={inputClassName} value={editando.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></FormField></div>
            <label className="flex items-center gap-2 text-sm text-kib-texto">
              <input type="checkbox" checked={editando.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Empresa ativa
            </label>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={excluindo !== null}
        title="Excluir empresa"
        message={`Excluir "${excluindo?.nome}" apaga também os contratos e cobranças dela. Para manter o histórico, prefira desmarcar "Empresa ativa".`}
        onClose={() => setExcluindo(null)}
        onConfirm={() => void excluir()}
      />
    </div>
  );
}
