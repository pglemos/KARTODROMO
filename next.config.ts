import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLICSUPABASE_ANON_KEY || '',
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/valores', destination: '/kart-locacao', permanent: true },
      { source: '/campeonatos/kac', destination: '/kac', permanent: true },
      { source: '/campeonatos/kac-super', destination: '/kac-super', permanent: true },
      { source: '/campeonatos/200-milhas', destination: '/200-milhas', permanent: true },
      { source: '/campeonatos/500-milhas', destination: '/500-milhas', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/design/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
