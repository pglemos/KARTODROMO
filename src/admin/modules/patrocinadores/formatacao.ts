import type { Contrato, Recorrencia, StatusCobranca, StatusContrato } from './patrocinadores.types';
import { mesesPorRecorrencia } from './patrocinadores.api';

export const inputClassName =
  'w-full rounded-lg border border-kib-borda-forte bg-kib-fundo min-h-11 px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-kib-texto placeholder:text-kib-texto-3 focus:border-kib-acao focus:outline-none focus:ring-2 focus:ring-kib-acao/20';

export const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dataBr = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
};

export const hojeIso = () => {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
};

export const somarDias = (iso: string, dias: number) => {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

export const diasAte = (iso: string) =>
  Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${hojeIso()}T00:00:00Z`).getTime()) / 86_400_000);

/** Valor mensal equivalente de um contrato ativo (pagamento único não entra na receita recorrente). */
export const valorMensal = (valor: number, recorrencia: Recorrencia) => {
  const meses = mesesPorRecorrencia[recorrencia];
  return meses ? valor / meses : 0;
};

/** Contrato ativo e dentro da vigência hoje: o espaço está ocupado. */
export const vigenteHoje = (contrato: Pick<Contrato, 'status' | 'data_inicio' | 'data_fim'>) => {
  const hoje = hojeIso();
  return contrato.status === 'ativo' && contrato.data_inicio <= hoje && (!contrato.data_fim || contrato.data_fim >= hoje);
};

/** Dois contratos disputam o mesmo espaço quando as vigências se sobrepõem. */
export const periodosSobrepoem = (a: { data_inicio: string; data_fim: string | null }, b: { data_inicio: string; data_fim: string | null }) =>
  (!b.data_fim || a.data_inicio <= b.data_fim) && (!a.data_fim || b.data_inicio <= a.data_fim);

export const badgeContrato: Record<StatusContrato, string> = {
  rascunho: 'border-kib-borda-forte bg-kib-campo text-kib-texto-2',
  ativo: 'border-kib-sucesso/40 bg-kib-sucesso-fundo text-kib-sucesso',
  encerrado: 'border-kib-borda-forte bg-kib-campo text-kib-texto-3',
  cancelado: 'border-kib-perigo/40 bg-kib-perigo-fundo text-kib-perigo',
};

export const badgeCobranca: Record<StatusCobranca, string> = {
  pendente: 'border-kib-aviso/40 bg-kib-aviso-fundo text-kib-aviso',
  atrasado: 'border-kib-perigo/40 bg-kib-perigo-fundo text-kib-perigo',
  pago: 'border-kib-sucesso/40 bg-kib-sucesso-fundo text-kib-sucesso',
  cancelado: 'border-kib-borda-forte bg-kib-campo text-kib-texto-3',
};

export const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  pendente: 'A receber',
  atrasado: 'Atrasado',
  pago: 'Pago',
};

export const tipoEspacoLabel: Record<string, string> = {
  outdoor: 'Outdoor',
  podio: 'Pódio',
  banner: 'Banner',
  telao: 'Telão',
  estrutura: 'Estrutura',
  outro: 'Outro',
};
