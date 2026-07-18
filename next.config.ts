import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLICSUPABASE_URL: process.env.NEXT_PUBLICSUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL || '',
    NEXT_PUBLICSUPABASE_ANON_KEY:
      process.env.NEXT_PUBLICSUPABASE_ANON_KEY || process.env.VITE_PUBLICSUPABASE_ANON_KEY || '',
  },
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/', destination: '/design/home.dc.html' },
      { source: '/pista', destination: '/design/pista.dc.html' },
      { source: '/kart-locacao', destination: '/design/kart-locacao.dc.html' },
      { source: '/campeonatos', destination: '/design/campeonatos.dc.html' },
      { source: '/eventos', destination: '/design/eventos.dc.html' },
      { source: '/duvidas', destination: '/design/duvidas.dc.html' },
      { source: '/kac', destination: '/design/kac.dc.html' },
      { source: '/campeonatos/kac', destination: '/design/kac.dc.html' },
      { source: '/kac-super', destination: '/design/kac-super.dc.html' },
      { source: '/campeonatos/kac-super', destination: '/design/kac-super.dc.html' },
      { source: '/200-milhas', destination: '/design/200-milhas.dc.html' },
      { source: '/campeonatos/200-milhas', destination: '/design/200-milhas.dc.html' },
      { source: '/500-milhas', destination: '/design/500-milhas.dc.html' },
      { source: '/campeonatos/500-milhas', destination: '/design/500-milhas.dc.html' },
      { source: '/clube-vantagens', destination: '/design/clube-vantagens.dc.html' },
      { source: '/clube-cadastro', destination: '/design/clube-cadastro.dc.html' },
      { source: '/clube-consulta', destination: '/design/clube-consulta.dc.html' },
      { source: '/clube-painel', destination: '/design/clube-painel.dc.html' },
      { source: '/clube-corridas', destination: '/design/clube-corridas.dc.html' },
      { source: '/clube-pontuacao', destination: '/design/clube-pontuacao.dc.html' },
      { source: '/clube-catalogo', destination: '/design/clube-catalogo.dc.html' },
      { source: '/clube-resgates', destination: '/design/clube-resgates.dc.html' },
      { source: '/clube-perfil', destination: '/design/clube-perfil.dc.html' },
      { source: '/clube-regulamento', destination: '/design/clube-regulamento.dc.html' },
      { source: '/clube-campanhas', destination: '/design/clube-campanhas.dc.html' },
    ];
  },
};

export default nextConfig;
