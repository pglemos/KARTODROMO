import type { NextConfig } from 'next';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLICSUPABASE_URL ||
  process.env.VITE_PUBLICSUPABASE_URL ||
  '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLICSUPABASE_ANON_KEY ||
  process.env.VITE_PUBLICSUPABASE_ANON_KEY ||
  '';

/**
 * As páginas públicas são os protótipos aprovados do design system, gerados em
 * public/design/ a partir de design-source/ (ver scripts/sync-design.mjs).
 * O endereço visível continua limpo: cada documento restaura a rota canônica
 * via history.replaceState.
 */
const designRoutes: Record<string, string> = {
  '/': 'home',
  '/pista': 'pista',
  '/kart-locacao': 'kart-locacao',
  '/campeonatos': 'campeonatos',
  '/eventos': 'eventos',
  '/duvidas': 'duvidas',
  '/kac': 'kac',
  '/kac-super': 'kac-super',
  '/200-milhas': '200-milhas',
  '/500-milhas': '500-milhas',
  '/100-milhas-light': '100-milhas-light',
  '/clube-vantagens': 'clube-vantagens',
  '/clube-cadastro': 'clube-cadastro',
  '/clube-consulta': 'clube-consulta',
  '/clube-painel': 'clube-painel',
  '/clube-corridas': 'clube-corridas',
  '/clube-pontuacao': 'clube-pontuacao',
  '/clube-catalogo': 'clube-catalogo',
  '/clube-resgates': 'clube-resgates',
  '/clube-perfil': 'clube-perfil',
  '/clube-regulamento': 'clube-regulamento',
  '/clube-campanhas': 'clube-campanhas',
};

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    NEXT_PUBLICSUPABASE_URL: supabaseUrl,
    NEXT_PUBLICSUPABASE_ANON_KEY: supabaseAnonKey,
  },
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      { source: '/valores', destination: '/kart-locacao', permanent: true },
      { source: '/campeonatos/kac', destination: '/kac', permanent: true },
      { source: '/campeonatos/kac-super', destination: '/kac-super', permanent: true },
      { source: '/campeonatos/200-milhas', destination: '/200-milhas', permanent: true },
      { source: '/campeonatos/500-milhas', destination: '/500-milhas', permanent: true },
      { source: '/campeonatos/100-milhas-light', destination: '/100-milhas-light', permanent: true },
      { source: '/100-milhas', destination: '/100-milhas-light', permanent: true },
      ...Object.entries(designRoutes).map(([source, page]) => ({
        source,
        destination: `/design/${page}.dc.html`,
        permanent: false,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Os documentos de design são as páginas públicas servidas; indexáveis.
        // Cache curto: o runtime relê o próprio HTML via fetch e, com cache de 1h, visitantes
        // viam a versão anterior da página por até uma hora depois de cada deploy.
        source: '/design/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, must-revalidate' }],
      },
      {
        // Protótipos administrativos ficam no repositório apenas como referência.
        source: '/design/:page(admin-.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ];
  },
};

export { designRoutes };

export default nextConfig;
