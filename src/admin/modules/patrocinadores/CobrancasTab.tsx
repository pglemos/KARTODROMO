import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/useToast';
import { badgeCobranca, dataBr, diasAte, hojeIso, inputClassName, moeda, statusLabel } from './formatacao';
import { patrocinadoresApi } from './patrocinadores.api';
import { Selo } from './Selo';
import type { Cobranca, Empresa, StatusCobranca } from './patrocinadores.types';

type Props = { cobrancas: Cobranca[]; empresas: Empresa[]; onChanged: () => Promise<void> };

const filtros: { valor: 'todas' | StatusCobranca; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'atrasado', rotulo: 'Atrasadas' },
  { valor: 'pendente', rotulo: 'A receber' },
  { valor: 'pago', rotulo: 'Pagas' },
  { valor: 'cancelado', rotulo: 'Canceladas' },
];

const formas = ['Pix', 'Transferência', 'Boleto', 'Dinheiro', 'Cartão', 'Permuta'];

export function CobrancasTab({ cobrancas, empresas, onChanged }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [filtro, setFiltro] = useState<'todas' | StatusCobranca>('todas');
  const [empresaId, setEmpresaId] = useState('');
  const [baixando, setBaixando] = useState<Cobranca | null>(null);
  const [pagoEm, setPagoEm] = useState(hojeIso());
  const [forma, setForma] = useState('Pix');
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(
    () => cobrancas.filter((c) => (filtro === 'todas' || c.status === filtro) && (!empresaId || c.empresa_id === empresaId)),
    [cobrancas, empresaId, filtro],
  );
  const total = lista.reduce((soma, c) => soma + c.valor, 0);

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    try {
      await acao();
      toastSuccess(sucesso);
      await onChanged();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível concluir a ação');
    }
  };

  const confirmarBaixa = async (event: FormEvent) => {
    event.preventDefault();
    if (!baixando) return;
    setSalvando(true);
    await executar(() => patrocinadoresApi.baixar(baixando.id, pagoEm, forma), 'Pagamento registrado');
    setSalvando(false);
    setBaixando(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar cobranças por status">
          {filtros.map((f) => (
            <button key={f.valor} type="button" aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filtro === f.valor ? 'border-kib-acao bg-kib-acao text-kib-sobre-acao' : 'border-kib-borda text-kib-texto-2 hover:bg-kib-campo'}`}>
              {f.rotulo}
            </button>
          ))}
        </div>
        <select aria-label="Filtrar por empresa" className={`${inputClassName} sm:max-w-60`} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <p className="ml-auto text-sm text-kib-texto-2">{lista.length} cobrança(s) · <strong className="text-kib-texto">{moeda(total)}</strong></p>
      </div>

      {lista.length === 0 ? (
        <Card className="p-8 text-center text-sm text-kib-texto-2">
          {cobrancas.length === 0 ? 'Nenhuma cobrança. Abra um contrato e use "Gerar cobranças" para programar as parcelas.' : 'Nenhuma cobrança com esse filtro.'}
        </Card>
      ) : (
        <Card className="divide-y divide-kib-borda">
          {lista.map((cobranca) => {
            const dias = diasAte(cobranca.vencimento);
            return (
              <div key={cobranca.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-bold text-kib-texto">{cobranca.empresa_nome ?? 'Empresa removida'}</p>
                  <p className="text-xs text-kib-texto-2">{cobranca.contrato_titulo} · parcela {cobranca.parcela}</p>
                </div>
                <div className="w-28 text-xs">
                  <p className="text-kib-texto-3">Vencimento</p>
                  <p className="font-bold text-kib-texto">{dataBr(cobranca.vencimento)}</p>
                  {(cobranca.status === 'pendente' || cobranca.status === 'atrasado') && (
                    <p className={dias < 0 ? 'text-kib-perigo' : 'text-kib-texto-3'}>{dias < 0 ? `${-dias} dia(s) de atraso` : dias === 0 ? 'vence hoje' : `em ${dias} dia(s)`}</p>
                  )}
                  {cobranca.status === 'pago' && <p className="text-kib-sucesso">pago em {dataBr(cobranca.pago_em)}</p>}
                </div>
                <p className="w-28 text-sm font-bold text-kib-texto">{moeda(cobranca.valor)}</p>
                <Selo classe={badgeCobranca[cobranca.status]}>{statusLabel[cobranca.status] ?? 'Cancelada'}</Selo>
                <div className="ml-auto flex gap-2 text-xs font-bold">
                  {(cobranca.status === 'pendente' || cobranca.status === 'atrasado') && (
                    <>
                      <Button className="!min-h-9 !px-3 !py-1.5 text-xs" onClick={() => { setPagoEm(hojeIso()); setBaixando(cobranca); }}>Dar baixa</Button>
                      <Button variant="ghost" className="!min-h-9 !px-3 !py-1.5 text-xs" onClick={() => void executar(() => patrocinadoresApi.cancelarCobranca(cobranca.id), 'Cobrança cancelada')}>Cancelar</Button>
                    </>
                  )}
                  {(cobranca.status === 'pago' || cobranca.status === 'cancelado') && (
                    <Button variant="ghost" className="!min-h-9 !px-3 !py-1.5 text-xs" onClick={() => void executar(() => patrocinadoresApi.reabrir(cobranca.id), 'Cobrança reaberta')}>Reabrir</Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal
        isOpen={baixando !== null}
        title="Registrar pagamento"
        onClose={() => setBaixando(null)}
        footer={<><Button variant="ghost" onClick={() => setBaixando(null)}>Cancelar</Button><Button type="submit" form="form-baixa" loading={salvando}>Confirmar pagamento</Button></>}
      >
        {baixando && (
          <form id="form-baixa" onSubmit={confirmarBaixa} className="grid gap-3">
            <p className="text-sm text-kib-texto-2">
              {baixando.empresa_nome} · parcela {baixando.parcela} · <strong className="text-kib-texto">{moeda(baixando.valor)}</strong>
            </p>
            <FormField label="Data do pagamento"><input type="date" className={inputClassName} value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} required /></FormField>
            <FormField label="Forma de pagamento">
              <select className={inputClassName} value={forma} onChange={(e) => setForma(e.target.value)}>
                {formas.map((f) => <option key={f}>{f}</option>)}
              </select>
            </FormField>
          </form>
        )}
      </Modal>
    </div>
  );
}
