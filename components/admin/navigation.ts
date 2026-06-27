export type AdminModuleKey =
  | 'dashboard'
  | 'reservas'
  | 'recepcao'
  | 'lanchonete'
  | 'cronometragem'
  | 'campeonatos'
  | 'resultados'
  | 'telao'
  | 'financeira'
  | 'clientes'
  | 'administrativa';

export type AdminModule = {
  key: AdminModuleKey;
  title: string;
  href: string;
  group: 'Geral' | 'Operação' | 'Competição' | 'Gestão';
  summary: string;
  status: string;
  features: string[];
};

export const adminModules: AdminModule[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    href: '/admin',
    group: 'Geral',
    summary: 'Visão geral dos módulos e indicadores operacionais do kartódromo.',
    status: 'Operacional',
    features: ['Resumo da operação', 'Atalhos por módulo', 'Status do sistema'],
  },
  {
    key: 'reservas',
    title: 'Reservas',
    href: '/admin/reservas',
    group: 'Operação',
    summary: 'Gestão de horários, clientes, pistas e andamento das reservas.',
    status: 'Módulo restaurado',
    features: ['Agenda de reservas', 'Cadastro de cliente', 'Status de atendimento'],
  },
  {
    key: 'recepcao',
    title: 'Recepção',
    href: '/admin/recepcao',
    group: 'Operação',
    summary: 'Fila de atendimento, check-in, termo e liberação de pilotos.',
    status: 'Módulo restaurado',
    features: ['Fila de atendimento', 'Check-in de pilotos', 'Controle de briefing'],
  },
  {
    key: 'lanchonete',
    title: 'Lanchonete',
    href: '/admin/lanchonete',
    group: 'Operação',
    summary: 'Venda no balcão, cadastro de produtos e controle de estoque.',
    status: 'Módulo restaurado',
    features: ['PDV', 'Produtos', 'Estoque'],
  },
  {
    key: 'cronometragem',
    title: 'Cronometragem',
    href: '/admin/cronometragem',
    group: 'Competição',
    summary: 'Sessões, voltas, LiveTime e operação da corrida em tempo real.',
    status: 'Módulo restaurado',
    features: ['Sessões', 'Voltas', 'LiveTime'],
  },
  {
    key: 'campeonatos',
    title: 'Campeonatos',
    href: '/admin/campeonatos',
    group: 'Competição',
    summary: 'Campeonatos, etapas, pilotos e regras de pontuação.',
    status: 'Módulo restaurado',
    features: ['Campeonatos', 'Etapas', 'Pilotos'],
  },
  {
    key: 'resultados',
    title: 'Resultados',
    href: '/admin/resultados',
    group: 'Competição',
    summary: 'Corridas, classificação, resultados e publicação de provas.',
    status: 'Módulo restaurado',
    features: ['Corridas', 'Classificação', 'Publicação'],
  },
  {
    key: 'telao',
    title: 'Telão',
    href: '/admin/telao',
    group: 'Competição',
    summary: 'Controle do painel LED, designer, ViPlex e páginas da TB50.',
    status: 'Operacional',
    features: ['Painel LED', 'Designer', 'ViPlex'],
  },
  {
    key: 'financeira',
    title: 'Financeiro',
    href: '/admin/financeira',
    group: 'Gestão',
    summary: 'Lançamentos, categorias, saldo e visão financeira da operação.',
    status: 'Módulo restaurado',
    features: ['Lançamentos', 'Categorias', 'Saldo'],
  },
  {
    key: 'clientes',
    title: 'Clientes',
    href: '/admin/clientes',
    group: 'Gestão',
    summary: 'Base unificada de clientes do sistema local (SRVKART) e do LapTime (CRONO1).',
    status: 'Módulo novo',
    features: ['Clientes locais', 'Clientes LapTime', 'Busca e paginação'],
  },
  {
    key: 'administrativa',
    title: 'Administrativa',
    href: '/admin/administrativa',
    group: 'Gestão',
    summary: 'Usuários, papéis de acesso, auditoria e configurações gerais.',
    status: 'Módulo restaurado',
    features: ['Usuários', 'Papéis', 'Auditoria'],
  },
];

export const adminNavigationGroups = ['Geral', 'Operação', 'Competição', 'Gestão'] as const;

export function getAdminModule(key: string) {
  return adminModules.find((module) => module.key === key);
}
