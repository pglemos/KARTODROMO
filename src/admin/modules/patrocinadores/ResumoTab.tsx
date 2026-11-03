import { AlertTriangle, CalendarClock, CircleDollarSign, Handshake } from 'lucide-react';
import { Card } from '../../ui/Card';
import { StatCard } from '../../ui/StatCard';
import { dataBr, diasAte, hojeIso, moeda, somarDias, tipoEspacoLabel, valorMensal, vigenteHoje } from './formatacao';
import type { Cobranca, Contrato, Espaco } from './patrocinadores.types';

type Props = {
  cobrancas: Cobranca[];
  contratos: Contrato[];
  espacos: Espaco[];
  carregando: boolean;
  irPara: (aba: 'contratos' | 'cobrancas' | 'espacos') => void;
};

export function ResumoTab({ carregando, cobrancas, contratos, espacos, irPara }: Props) {
  const vigentes = contratos.filter(vigenteHoje);
  const mensal = vigentes.reduce((soma, c) => soma + valorMensal(c.valor, c.recorrencia), 0);
  const atrasadas = cobrancas.filter((c) => c.status === 'atrasado');
  const aReceber = cobrancas.filter((c) => c.status === 'pendente' || c.status === 'atrasado');
  const limite = somarDias(hojeIso(), 30);
  const proximas = cobrancas.filter((c) => c.status === 'pendente' && c.vencimento <= limite).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
  const vencendo = vigentes.filter((c) => c.data_fim && c.data_fim <= limite).sort((a, b) => (a.data_fim as string).localeCompare(b.data_fim as string));
  const ativos = espacos.filter((e) => e.ativo);
  const ocupados = ativos.filter((e) => vigentes.some((c) => c.espaco_id === e.id)).length;
  const somaAtrasado = atrasadas.reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CircleDollarSign} label="Receita mensal contratada" value={moeda(mensal)} sub={`${vigentes.length} contrato(s) vigente(s)`} loading={carregando} />
        <StatCard icon={CalendarClock} label="A receber" value={moeda(aReceber.reduce((s, c) => s + c.valor, 0))} sub={`${aReceber.length} cobrança(s) em aberto`} loading={carregando} />
        <StatCard icon={AlertTriangle} label="Em atraso" value={moeda(somaAtrasado)} sub={`${atrasadas.length} cobrança(s) vencida(s)`} loading={carregando} />
        <StatCard icon={Handshake} label="Espaços ocupados" value={`${ocupados} de ${ativos.length}`} sub={ativos.length ? `${ativos.length - ocupados} livre(s) para vender` : 'Cadastre os espaços'} loading={carregando} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-kib-texto">Cobranças dos próximos 30 dias</h3>
            <button type="button" className="text-xs font-bold text-kib-acao hover:underline" onClick={() => irPara('cobrancas')}>Ver todas</button>
          </div>
          {atrasadas.length > 0 && (
            <button type="button" onClick={() => irPara('cobrancas')} className="mb-3 w-full rounded-lg bg-kib-perigo-fundo px-3 py-2 text-left text-xs font-bold text-kib-perigo">
              {atrasadas.length} cobrança(s) em atraso somando {moeda(somaAtrasado)} — resolver agora
            </button>
          )}
          {proximas.length === 0 ? (
            <p className="text-sm text-kib-texto-2">Nada a vencer nos próximos 30 dias.</p>
          ) : (
            <ul className="divide-y divide-kib-borda">
              {proximas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-bold text-kib-texto">{c.empresa_nome}</span><span className="text-xs text-kib-texto-3">{dataBr(c.vencimento)} · em {diasAte(c.vencimento)} dia(s)</span></span>
                  <span className="font-bold text-kib-texto">{moeda(c.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-kib-texto">Contratos vencendo em 30 dias</h3>
            <button type="button" className="text-xs font-bold text-kib-acao hover:underline" onClick={() => irPara('contratos')}>Ver contratos</button>
          </div>
          {vencendo.length === 0 ? (
            <p className="text-sm text-kib-texto-2">Nenhum contrato perto do fim.</p>
          ) : (
            <ul className="divide-y divide-kib-borda">
              {vencendo.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-bold text-kib-texto">{c.empresa_nome}</span><span className="text-xs text-kib-texto-3">{c.espaco_nome ?? c.titulo}</span></span>
                  <span className="text-xs font-bold text-kib-aviso">{dataBr(c.data_fim)}{c.renovacao_automatica ? ' · renova' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-kib-texto">Mapa de espaços</h3>
          <button type="button" className="text-xs font-bold text-kib-acao hover:underline" onClick={() => irPara('espacos')}>Gerenciar espaços</button>
        </div>
        {ativos.length === 0 ? (
          <p className="text-sm text-kib-texto-2">Cadastre os outdoors e o pódio na aba Espaços para ver a ocupação.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ativos.map((e) => {
              const contrato = vigentes.find((c) => c.espaco_id === e.id);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-kib-borda bg-kib-fundo px-3 py-2.5">
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-kib-texto">{e.nome}</span><span className="text-xs text-kib-texto-3">{contrato ? contrato.empresa_nome : tipoEspacoLabel[e.tipo]}</span></span>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${contrato ? 'border-kib-info/40 bg-kib-info-fundo text-kib-info' : 'border-kib-sucesso/40 bg-kib-sucesso-fundo text-kib-sucesso'}`}>{contrato ? 'Ocupado' : 'Livre'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
