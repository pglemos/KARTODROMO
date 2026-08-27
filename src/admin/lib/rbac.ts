export type Role =
  | 'owner'
  | 'admin'
  | 'financeiro'
  | 'recepcao'
  | 'lanchonete'
  | 'operador_telao'
  | 'viewer';

export type ModuleKey =
  | 'dashboard'
  | 'reservas'
  | 'cronometragem'
  | 'resultados'
  | 'campeonatos'
  | 'financeira'
  | 'lanchonete'
  | 'recepcao'
  | 'telao'
  | 'clientes'
  | 'equalizacao'
  | 'administrativa'
  | 'clube';

export const roles: readonly Role[] = [
  'owner',
  'admin',
  'financeiro',
  'recepcao',
  'lanchonete',
  'operador_telao',
  'viewer',
];

const allModules: readonly ModuleKey[] = [
  'dashboard',
  'reservas',
  'cronometragem',
  'resultados',
  'campeonatos',
  'financeira',
  'lanchonete',
  'recepcao',
  'telao',
  'clientes',
  'equalizacao',
  'administrativa',
  'clube',
];

export const roleModules: Readonly<Record<Role, readonly ModuleKey[]>> = {
  owner: allModules,
  admin: allModules,
  financeiro: ['dashboard', 'financeira'],
  recepcao: ['dashboard', 'reservas', 'recepcao', 'clientes'],
  lanchonete: ['dashboard', 'lanchonete'],
  operador_telao: ['dashboard', 'cronometragem', 'resultados', 'telao'],
  viewer: ['dashboard'],
};

/**
 * Módulos em que cada papel pode alterar dados.
 * A checagem visual no cliente é apenas conveniência; as rotas de API usam
 * a mesma regra antes de executar qualquer mutação.
 */
export const roleWriteModules: Readonly<Record<Role, readonly ModuleKey[]>> = {
  owner: allModules,
  admin: allModules,
  financeiro: ['financeira'],
  recepcao: ['reservas', 'recepcao'],
  lanchonete: ['lanchonete'],
  operador_telao: ['cronometragem', 'resultados', 'telao'],
  viewer: [],
};

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && roles.some((role) => role === value);

export const canAccess = (role: Role, moduleKey: ModuleKey): boolean =>
  roleModules[role].includes(moduleKey);

export const canWrite = (role: Role, moduleKey: ModuleKey): boolean =>
  roleWriteModules[role].includes(moduleKey);
