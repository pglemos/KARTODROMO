import routeMetadata from './public-routes.json';

export type PublicRouteAvailability = 'active' | 'coming-soon';

export type PublicRouteKey =
  | 'home'
  | 'pista'
  | 'kart-locacao'
  | 'reservas'
  | 'eventos'
  | 'campeonatos'
  | 'historia'
  | 'duvidas'
  | 'kac'
  | 'kac-super'
  | '200-milhas'
  | '500-milhas'
  | 'clube-vantagens'
  | 'clube-cadastro'
  | 'clube-consulta'
  | 'clube-painel'
  | 'clube-corridas'
  | 'clube-pontuacao'
  | 'clube-catalogo'
  | 'clube-resgates'
  | 'clube-perfil'
  | 'clube-regulamento'
  | 'clube-campanhas';

export type PublicRouteDefinition = {
  key: PublicRouteKey;
  path: string;
  title: string;
  description: string;
  availability: PublicRouteAvailability;
  includeInSitemap: boolean;
};

export const PUBLIC_ROUTES: readonly PublicRouteDefinition[] = routeMetadata.map((route) => ({
  key: route.key as PublicRouteKey,
  path: route.path,
  title: route.title,
  description: route.description,
  availability: route.availability as PublicRouteAvailability,
  includeInSitemap: route.availability === 'active',
}));

export const PUBLIC_ROUTE_BY_PATH: Readonly<Record<string, PublicRouteDefinition>> = Object.freeze(
  Object.fromEntries(PUBLIC_ROUTES.map((route) => [route.path, route])),
);

export function normalizePublicPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const normalized = `/${pathname}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

export function findPublicRoute(pathname: string): PublicRouteDefinition | undefined {
  return PUBLIC_ROUTE_BY_PATH[normalizePublicPath(pathname)];
}

export function getPublicRoute(pathname: string): PublicRouteDefinition {
  return findPublicRoute(pathname) ?? PUBLIC_ROUTE_BY_PATH['/'];
}

export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kartodromodebetim.com.br').replace(/\/$/, '');
