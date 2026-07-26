import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/src/config/publicRoutes';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/design/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
