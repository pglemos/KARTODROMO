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

const active = (
  key: PublicRouteKey,
  path: string,
  title: string,
  description: string,
): PublicRouteDefinition => ({ key, path, title, description, availability: 'active', includeInSitemap: true });

const comingSoon = (
  key: PublicRouteKey,
  path: string,
  title: string,
  description: string,
): PublicRouteDefinition => ({ key, path, title, description, availability: 'coming-soon', includeInSitemap: false });

export const PUBLIC_ROUTES: readonly PublicRouteDefinition[] = [
  active('home', '/', 'Kartódromo Internacional de Betim', 'Kart de locação, campeonatos, eventos e experiências de velocidade no Kartódromo Internacional de Betim.'),
  active('pista', '/pista', 'A Pista | Kartódromo Internacional de Betim', 'Conheça a pista homologada de 1.110 metros, os traçados oficiais e a estrutura do Kartódromo de Betim.'),
  active('kart-locacao', '/kart-locacao', 'Kart de Locação em Betim | Reserve Online', 'Reserve uma bateria de kart de locação com equipamento e cronometragem no Kartódromo Internacional de Betim.'),
  active('reservas', '/reservas', 'Reservas | Kartódromo Internacional de Betim', 'Consulte horários, preços, condições e faça sua reserva na plataforma oficial do Kartódromo de Betim.'),
  active('eventos', '/eventos', 'Eventos, Aniversários e Empresas | Kartódromo de Betim', 'Organize aniversários, encontros e eventos corporativos com kart, pódio e estrutura completa em Betim.'),
  active('campeonatos', '/campeonatos', 'Campeonatos de Kart | Kartódromo de Betim', 'Conheça os campeonatos, calendários, regulamentos e inscrições do Kartódromo Internacional de Betim.'),
  active('historia', '/historia', 'Nossa História | Kartódromo Internacional de Betim', 'Conheça a história, a evolução e a ficha técnica do Kartódromo Internacional de Betim.'),
  active('duvidas', '/duvidas', 'Dúvidas Frequentes | Kartódromo de Betim', 'Respostas sobre reservas, segurança, kart de locação, grupos, eventos e campeonatos.'),
  active('kac', '/kac', 'KAC Iniciantes 2026 | Kartódromo de Betim', 'Campeonato mensal de Kart Light para pilotos iniciantes no Kartódromo Internacional de Betim.'),
  active('kac-super', '/kac-super', 'KAC Super Kart 2026 | Kartódromo de Betim', 'Campeonato anual de Super Kart com calendário, regulamento e pontuação acumulada.'),
  active('200-milhas', '/200-milhas', '200 Milhas de Betim | Endurance de Kart', 'Informações, regulamento e histórico das 200 Milhas de Betim, endurance estratégico em equipe.'),
  active('500-milhas', '/500-milhas', '500 Milhas de Betim | Ultra Endurance de Kart', 'Informações, regulamento e inscrições das 500 Milhas de Betim, a prova mais longa do calendário.'),
  active('clube-vantagens', '/clube-vantagens', 'Clube de Vantagens | Kartódromo de Betim', 'Conheça o programa de relacionamento e as vantagens planejadas para clientes frequentes do Kartódromo de Betim.'),
  comingSoon('clube-cadastro', '/clube-cadastro', 'Cadastro do Clube em Implantação | Kartódromo de Betim', 'O cadastro do Clube de Vantagens está em implantação e será liberado após a integração segura com o sistema de corridas.'),
  comingSoon('clube-consulta', '/clube-consulta', 'Consulta de Pontos em Implantação | Kartódromo de Betim', 'A consulta autenticada de pontos do Clube de Vantagens está em implantação.'),
  comingSoon('clube-painel', '/clube-painel', 'Portal do Clube em Implantação | Kartódromo de Betim', 'O portal autenticado do Clube de Vantagens está em implantação.'),
  comingSoon('clube-corridas', '/clube-corridas', 'Histórico do Clube em Implantação | Kartódromo de Betim', 'O histórico autenticado de corridas do Clube de Vantagens está em implantação.'),
  comingSoon('clube-pontuacao', '/clube-pontuacao', 'Pontuação do Clube em Implantação | Kartódromo de Betim', 'A pontuação autenticada do Clube de Vantagens está em implantação.'),
  comingSoon('clube-catalogo', '/clube-catalogo', 'Catálogo do Clube em Implantação | Kartódromo de Betim', 'O catálogo transacional do Clube de Vantagens está em implantação.'),
  comingSoon('clube-resgates', '/clube-resgates', 'Resgates do Clube em Implantação | Kartódromo de Betim', 'O histórico autenticado de resgates do Clube de Vantagens está em implantação.'),
  comingSoon('clube-perfil', '/clube-perfil', 'Perfil do Clube em Implantação | Kartódromo de Betim', 'A área autenticada de perfil do Clube de Vantagens está em implantação.'),
  active('clube-regulamento', '/clube-regulamento', 'Regulamento do Clube de Vantagens | Kartódromo de Betim', 'Consulte as regras públicas do Clube de Vantagens do Kartódromo Internacional de Betim.'),
  comingSoon('clube-campanhas', '/clube-campanhas', 'Campanhas do Clube em Implantação | Kartódromo de Betim', 'A área autenticada de campanhas do Clube de Vantagens está em implantação.'),
] as const;

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
