import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicSiteClient } from '../PublicSiteClient';
import { findPublicRoute, normalizePublicPath, SITE_ORIGIN } from '@/src/config/publicRoutes';

type PublicSitePageProps = {
  params: Promise<{ slug?: string[] }>;
};

function pathnameFromSlug(slug?: string[]): string {
  return normalizePublicPath(slug?.length ? `/${slug.join('/')}` : '/');
}

export async function generateMetadata({ params }: PublicSitePageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = pathnameFromSlug(slug);
  const route = findPublicRoute(pathname);

  if (!route) {
    return {
      title: 'Página não encontrada | Kartódromo Internacional de Betim',
      description: 'O endereço informado não corresponde a uma página pública ativa do Kartódromo Internacional de Betim.',
      robots: { index: false, follow: false, noarchive: true },
    };
  }

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

export default async function PublicSitePage({ params }: PublicSitePageProps) {
  const { slug } = await params;
  const route = findPublicRoute(pathnameFromSlug(slug));
  if (!route) notFound();

  return <PublicSiteClient />;
}
