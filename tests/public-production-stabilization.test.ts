import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';
import { PUBLIC_ROUTES, getPublicRoute } from '../src/config/publicRoutes';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const canonicalPaths = [
  '/',
  '/pista',
  '/kart-locacao',
  '/reservas',
  '/eventos',
  '/campeonatos',
  '/historia',
  '/duvidas',
  '/kac',
  '/kac-super',
  '/200-milhas',
  '/500-milhas',
  '/clube-vantagens',
  '/clube-cadastro',
  '/clube-consulta',
  '/clube-painel',
  '/clube-corridas',
  '/clube-pontuacao',
  '/clube-catalogo',
  '/clube-resgates',
  '/clube-perfil',
  '/clube-regulamento',
  '/clube-campanhas',
] as const;

describe('public route registry', () => {
  it('contains every canonical route exactly once', () => {
    expect(PUBLIC_ROUTES.map((route) => route.path)).toEqual(canonicalPaths);
    expect(new Set(PUBLIC_ROUTES.map((route) => route.path)).size).toBe(PUBLIC_ROUTES.length);
  });

  it('returns route-specific metadata and falls back safely', () => {
    expect(getPublicRoute('/kart-locacao').title).toContain('Kart de Locação');
    expect(getPublicRoute('/500-milhas').description).toContain('500 Milhas');
    expect(getPublicRoute('/rota-inexistente').path).toBe('/');
  });

  it('marks customer-specific club pages as unavailable until authentication exists', () => {
    const customerRoutes = PUBLIC_ROUTES.filter((route) => route.path.startsWith('/clube-') && !['/clube-vantagens', '/clube-regulamento'].includes(route.path));
    expect(customerRoutes.length).toBeGreaterThan(0);
    expect(customerRoutes.every((route) => route.availability === 'coming-soon')).toBe(true);
  });
});

describe('production routing', () => {
  it('never redirects canonical pages to design documents', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ destination: expect.stringContaining('/design/') }),
    ]));
  });

  it('permanently normalizes legacy aliases', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/valores', destination: '/kart-locacao', permanent: true }),
      expect.objectContaining({ source: '/campeonatos/kac', destination: '/kac', permanent: true }),
    ]));
  });

  it('does not use BrowserRouter or a white mount gate', () => {
    expect(read('src/App.tsx')).not.toContain('BrowserRouter');
    expect(read('src/App.tsx')).toContain('usePathname');
    expect(read('app/PublicSiteClient.tsx')).not.toContain('bg-white');
    expect(read('app/PublicSiteClient.tsx')).not.toContain('setMounted');
  });
});

describe('club safety', () => {
  it('does not expose mock identities or fake transactional success', () => {
    const source = read('src/site-pages/ClubPages.tsx');
    expect(source).not.toContain('Rafael Nogueira');
    expect(source).not.toContain('123.456.789-00');
    expect(source).not.toContain('Cadastro realizado!');
    expect(source).not.toContain('Alterações salvas.');
    expect(source).not.toContain('onClick={()=>setBalance');
    expect(source).toContain('Portal em implantação');
  });
});
