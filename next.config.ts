import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLICSUPABASE_URL: process.env.NEXT_PUBLICSUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL || '',
    NEXT_PUBLICSUPABASE_ANON_KEY:
      process.env.NEXT_PUBLICSUPABASE_ANON_KEY || process.env.VITE_PUBLICSUPABASE_ANON_KEY || '',
  },
  reactStrictMode: true,
  async rewrites() {
    // Substitui o antigo vercel.json (nunca lido pelo Cloudflare Workers/OpenNext).
    // Encaminha tudo para o proxy unico do widget de agendamento MyLapTime.
    return [
      { source: '/booking', destination: '/api/mylaptime-proxy/booking' },
      { source: '/api/auth/:path*', destination: '/api/mylaptime-proxy/auth/:path*' },
      { source: '/mylaptime/:path*', destination: '/api/mylaptime-proxy/mylaptime/:path*' },
      { source: '/_content/:path*', destination: '/api/mylaptime-proxy/content/:path*' },
      { source: '/_framework/:path*', destination: '/api/mylaptime-proxy/framework/:path*' },
      { source: '/_blazor', destination: '/api/mylaptime-proxy/blazor' },
      { source: '/_blazor/:path*', destination: '/api/mylaptime-proxy/blazor/:path*' },
      { source: '/LapTime.Web.Tools.styles.css', destination: '/api/mylaptime-proxy/styles' },
    ];
  },
};

export default nextConfig;
