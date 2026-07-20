import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, SITE_ORIGIN } from '@/src/config/publicRoutes';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PUBLIC_ROUTES
    .filter((route) => route.includeInSitemap && route.availability === 'active')
    .map((route) => ({
      url: `${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`,
      lastModified: now,
      changeFrequency: route.path === '/' ? 'weekly' : 'monthly',
      priority: route.path === '/' ? 1 : route.path === '/kart-locacao' || route.path === '/reservas' ? 0.9 : 0.7,
    }));
}
