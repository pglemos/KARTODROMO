import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLICSUPABASE_URL: process.env.NEXT_PUBLICSUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL || '',
    NEXT_PUBLICSUPABASE_ANON_KEY:
      process.env.NEXT_PUBLICSUPABASE_ANON_KEY || process.env.VITE_PUBLICSUPABASE_ANON_KEY || '',
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/', destination: '/design/home.dc.html', permanent: false },
      { source: '/pista', destination: '/design/pista.dc.html', permanent: false },
      { source: '/kart-locacao', destination: '/design/kart-locacao.dc.html', permanent: false },
      { source: '/campeonatos', destination: '/design/campeonatos.dc.html', permanent: false },
      { source: '/eventos', destination: '/design/eventos.dc.html', permanent: false },
      { source: '/duvidas', destination: '/design/duvidas.dc.html', permanent: false },
      { source: '/kac', destination: '/design/kac.dc.html', permanent: false },
      { source: '/campeonatos/kac', destination: '/design/kac.dc.html', permanent: false },
      { source: '/kac-super', destination: '/design/kac-super.dc.html', permanent: false },
      { source: '/campeonatos/kac-super', destination: '/design/kac-super.dc.html', permanent: false },
      { source: '/200-milhas', destination: '/design/200-milhas.dc.html', permanent: false },
      { source: '/campeonatos/200-milhas', destination: '/design/200-milhas.dc.html', permanent: false },
      { source: '/500-milhas', destination: '/design/500-milhas.dc.html', permanent: false },
      { source: '/campeonatos/500-milhas', destination: '/design/500-milhas.dc.html', permanent: false },
      { source: '/clube-vantagens', destination: '/design/clube-vantagens.dc.html', permanent: false },
      { source: '/clube-cadastro', destination: '/design/clube-cadastro.dc.html', permanent: false },
      { source: '/clube-consulta', destination: '/design/clube-consulta.dc.html', permanent: false },
      { source: '/clube-painel', destination: '/design/clube-painel.dc.html', permanent: false },
      { source: '/clube-corridas', destination: '/design/clube-corridas.dc.html', permanent: false },
      { source: '/clube-pontuacao', destination: '/design/clube-pontuacao.dc.html', permanent: false },
      { source: '/clube-catalogo', destination: '/design/clube-catalogo.dc.html', permanent: false },
      { source: '/clube-resgates', destination: '/design/clube-resgates.dc.html', permanent: false },
      { source: '/clube-perfil', destination: '/design/clube-perfil.dc.html', permanent: false },
      { source: '/clube-regulamento', destination: '/design/clube-regulamento.dc.html', permanent: false },
      { source: '/clube-campanhas', destination: '/design/clube-campanhas.dc.html', permanent: false },
    ];
  },
};

export default nextConfig;
