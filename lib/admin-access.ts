import { canAccess, canWrite, type ModuleKey, type Role } from '@/src/admin/lib/rbac';

const resourceModules: Readonly<Record<string, readonly ModuleKey[]>> = {
  profiles: ['administrativa'],
  audit_log: ['administrativa'],
  clientes: ['clientes', 'recepcao', 'reservas'],
  pistas: ['reservas'],
  reservas: ['reservas'],
  reservas_full: ['reservas'],
  recepcao_atendimentos: ['recepcao'],
  recepcao_full: ['recepcao'],
  lanchonete_produtos: ['lanchonete'],
  lanchonete_estoque: ['lanchonete'],
  lanchonete_vendas: ['lanchonete'],
  registrar_venda: ['lanchonete'],
  financeiro_categorias: ['financeira'],
  financeiro_lancamentos: ['financeira'],
  financeiro_full: ['financeira'],
  campeonatos: ['campeonatos', 'cronometragem'],
  etapas: ['campeonatos', 'cronometragem'],
  etapas_full: ['campeonatos', 'cronometragem'],
  pilotos: ['campeonatos', 'cronometragem'],
  classificacao: ['campeonatos', 'cronometragem'],
  classificacao_full: ['campeonatos', 'cronometragem'],
  sessoes: ['campeonatos', 'cronometragem'],
  sessoes_full: ['campeonatos', 'cronometragem'],
  voltas: ['cronometragem'],
  corridas: ['campeonatos', 'cronometragem', 'resultados'],
  corridas_full: ['campeonatos', 'cronometragem', 'resultados'],
  formatos_corrida: ['campeonatos', 'cronometragem'],
  resultados: ['cronometragem', 'resultados'],
  resultados_full: ['cronometragem', 'resultados'],
  cronometragem_live: ['cronometragem'],
  karts: ['equalizacao'],
  karts_full: ['equalizacao'],
  karts_manutencao: ['equalizacao'],
  karts_equalizacoes: ['equalizacao'],
  karts_equalizacoes_full: ['equalizacao'],
  karts_equalizacao_sessoes: ['equalizacao'],
  karts_equalizacao_capturas: ['equalizacao'],
  karts_identidade_historico: ['equalizacao'],
  eventos: ['administrativa'],
  eventos_full: ['administrativa'],
  clube_participantes: ['clube'],
  clube_recompensas: ['clube'],
  clube_resgates: ['clube'],
  clube_resgates_full: ['clube'],
  clube_campanhas: ['clube'],
  clube_transacoes: ['clube'],
};

export function modulesForAdminResource(resource: string): readonly ModuleKey[] {
  return resourceModules[resource] || [];
}

export function canAccessAny(role: Role, modules: readonly ModuleKey[]) {
  return modules.some((moduleKey) => canAccess(role, moduleKey));
}

export function canWriteAny(role: Role, modules: readonly ModuleKey[]) {
  return modules.some((moduleKey) => canWrite(role, moduleKey));
}

export function moduleForAdminPath(value: string): ModuleKey | null {
  const segments = value.replace(/^\/+/, '').split('/').filter(Boolean);
  const normalized = segments[0] === 'admin' ? segments[1] || 'admin' : segments[0] || 'admin';
  if (normalized === 'admin') return 'dashboard';
  if (normalized === 'telao' || normalized === 'designer-telao') return 'telao';
  return modulesForAdminResource(normalized)[0] || null;
}
