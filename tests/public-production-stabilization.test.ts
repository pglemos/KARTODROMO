import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig, { designRoutes } from '../next.config';
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
  it('serves every canonical design page from the approved prototypes', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];

    for (const [source, page] of Object.entries(designRoutes)) {
      expect(redirects).toEqual(expect.arrayContaining([
        expect.objectContaining({ source, destination: `/design/${page}.dc.html`, permanent: false }),
      ]));
      expect(existsSync(join(process.cwd(), 'public', 'design', `${page}.dc.html`))).toBe(true);
    }
  });

  it('keeps the design route map aligned with the generator', async () => {
    const { routes } = await import('../scripts/sync-design.mjs');
    const generated = Object.fromEntries(
      Object.entries(routes as Record<string, string>).map(([page, path]) => [path, page]),
    );

    expect(generated).toEqual(designRoutes);
  });

  it('does not leave routes without an implementation', () => {
    const reactOnly = PUBLIC_ROUTES.filter((route) => !(route.path in designRoutes)).map((route) => route.path);

    expect(reactOnly).toEqual(['/reservas', '/historia']);
  });

  it('injects canonical SEO metadata into every served prototype', () => {
    for (const [path, page] of Object.entries(designRoutes)) {
      const html = read(join('public', 'design', `${page}.dc.html`));
      const route = getPublicRoute(path);
      const canonical = `https://kartodromodebetim.com.br${path === '/' ? '' : path}`;
      const robots = route.availability === 'active' ? 'index, follow' : 'noindex, follow, noarchive';

      expect(html, `${page}: title`).toContain(`<title>${route.title}</title>`);
      expect(html, `${page}: canonical`).toContain(`<link rel="canonical" href="${canonical}">`);
      expect(html, `${page}: robots`).toContain(`<meta name="robots" content="${robots}">`);
      expect(html.match(/<meta name="description"/g)?.length ?? 0, `${page}: description única`).toBe(1);
    }
  });

  it('keeps the mobile layer on every served page', () => {
    for (const [path, page] of Object.entries(designRoutes)) {
      const html = read(join('public', 'design', `${page}.dc.html`));

      expect(html, `${page}: camada mobile`).toContain('data-generated="mobile-fit"');
      expect(html, `${page}: alvo de toque`).toContain('min-height: 44px');
      expect(html, `${page}: zoom iOS`).toContain('input, select, textarea { font-size: 16px !important; }');
      if (path.startsWith('/clube-')) {
        expect(html, `${page}: aba ativa no mobile`).toContain('data-generated="club-tab-focus"');
      }
    }
  });

  it('permanently normalizes legacy aliases', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: '/valores', destination: '/kart-locacao', permanent: true }),
      expect.objectContaining({ source: '/campeonatos/kac', destination: '/kac', permanent: true }),
    ]));
  });

  it('does not use BrowserRouter or a white mount gate', () => {
    const appSource = read('src/App.tsx');
    const headerSource = read('src/components/Header.tsx');

    expect(appSource).not.toContain('BrowserRouter');
    expect(appSource).not.toContain('react-router-dom');
    expect(appSource).toContain('usePathname');
    expect(headerSource).not.toContain('react-router-dom');
    expect(headerSource).toContain('usePathname');
    expect(read('app/PublicSiteClient.tsx')).not.toContain('bg-white');
    expect(read('app/PublicSiteClient.tsx')).not.toContain('setMounted');
  });
});

describe('club safety', () => {
  it('does not expose mock identities or fake transactional success', () => {
    const source = [
      read('src/site-pages/ClubPages.tsx'),
      read('src/components/club/ClubPortalUnavailable.tsx'),
    ].join('\n');

    expect(source).not.toContain('Rafael Nogueira');
    expect(source).not.toContain('123.456.789-00');
    expect(source).not.toContain('Cadastro realizado!');
    expect(source).not.toContain('Alterações salvas.');
    expect(source).not.toContain('onClick={()=>setBalance');
    expect(source).toContain('Portal em implantação');
    expect(source).toContain('Nenhum cadastro, saldo, alteração de perfil ou resgate é processado');
  });
});
