import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Front da reserva online (reservas.kartodromodebetim.com.br). Gera em reservas-deploy/dist, servido pelo worker
// kartodromo-reservas-2026 (reservas-deploy/worker.js); /api/* vai para o worker kartodromo-cadastro.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: resolve(__dirname, '../../reservas-deploy/dist'),
    emptyOutDir: false,
    assetsDir: 'booking-assets',
    target: 'es2020',
  },
  server: { port: 5180, proxy: { '/api': { target: 'https://reservas.kartodromodebetim.com.br', changeOrigin: true }, '/booking-media': { target: 'https://reservas.kartodromodebetim.com.br', changeOrigin: true } } },
});
