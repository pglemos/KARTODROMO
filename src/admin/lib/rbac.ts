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
  | 'administrativa';

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
  'administrativa',
];

export const roleModules: Readonly<Record<Role, readonly ModuleKey[]>> = {
  owner: allModules,
  admin: allModules,
  financeiro: ['dashboard', 'financeira'],
  recepcao: ['dashboard', 'reservas', 'recepcao'],
  lanchonete: ['dashboard', 'lanchonete'],
  operador_telao: ['dashboard', 'cronometragem', 'resultados', 'telao'],
  viewer: ['dashboard'],
};

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && roles.some((role) => role === value);

export const canAccess = (role: Role, moduleKey: ModuleKey): boolean =>
  roleModules[role].includes(moduleKey);
