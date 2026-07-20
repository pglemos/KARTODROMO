import type { Metadata } from 'next';
import { PublicSiteClient } from '../PublicSiteClient';
import { getPublicRoute, normalizePublicPath, SITE_ORIGIN } from '@/src/config/publicRoutes';

type PublicSitePageProps = {
  params: Promise<{ slug?: string[] }>;
};

function pathnameFromSlug(slug?: string[]): string {
  return normalizePublicPath(slug?.length ? `/${slug.join('/')}` : '/');
}

export async function generateMetadata({ params }: PublicSitePageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getPublicRoute(pathnameFromSlug(slug));
  const canonical = `${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`;

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical },
    robots: route.availability === 'active'
      ? { index: true, follow: true }
      : { index: false, follow: true, noarchive: true },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: 'Kartódromo Internacional de Betim',
      title: route.title,
      description: route.description,
      url: canonical,
      images: [
        {
          url: `${SITE_ORIGIN}/posters/home-karting.jpg`,
          width: 1200,
          height: 630,
          alt: 'Kartódromo Internacional de Betim',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: route.title,
      description: route.description,
      images: [`${SITE_ORIGIN}/posters/home-karting.jpg`],
    },
  };
}

export default function PublicSitePage() {
  return <PublicSiteClient />;
}
