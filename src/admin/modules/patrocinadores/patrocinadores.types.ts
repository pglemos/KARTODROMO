export type Recorrencia = 'unico' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type StatusContrato = 'rascunho' | 'ativo' | 'encerrado' | 'cancelado';
export type StatusCobranca = 'pendente' | 'atrasado' | 'pago' | 'cancelado';
export type TipoEspaco = 'outdoor' | 'podio' | 'banner' | 'telao' | 'estrutura' | 'outro';
export type CategoriaArquivo = 'logo' | 'arte' | 'contrato' | 'foto' | 'outro';

export type Empresa = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  segmento: string | null;
  contato_nome: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  endereco: string | null;
  observacoes: string | null;
  logo_arquivo_id: string | null;
  ativo: boolean;
};

export type Espaco = {
  id: string;
  nome: string;
  tipo: TipoEspaco;
  localizacao: string | null;
  dimensoes: string | null;
  descricao: string | null;
  valor_tabela: number;
  foto_arquivo_id: string | null;
  ativo: boolean;
};

export type Contrato = {
  id: string;
  empresa_id: string;
  espaco_id: string | null;
  titulo: string;
  status: StatusContrato;
  valor: number;
  recorrencia: Recorrencia;
  dia_vencimento: number;
  data_inicio: string;
  data_fim: string | null;
  renovacao_automatica: boolean;
  arte_arquivo_id: string | null;
  contrato_arquivo_id: string | null;
  observacoes: string | null;
  empresa_nome: string | null;
  espaco_nome: string | null;
  espaco_tipo: TipoEspaco | null;
};

export type Cobranca = {
  id: string;
  contrato_id: string;
  parcela: number;
  vencimento: string;
  valor: number;
  status: StatusCobranca;
  pago_em: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  contrato_titulo: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
};

export type ArquivoEnviado = { id: string; nome: string; mime: string; tamanho: number; categoria: CategoriaArquivo };
