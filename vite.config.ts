import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const user = env.FORM_MANAGEMENT_USER || env.FORM_MANAGERMENT_USER || env.VITE_FORM_MANAGERMENT_USER || '';
  const key = env.FORM_MANAGEMENT_KEY || env.FORM_MANAGERMENT_KEY || env.VITE_FORM_MANAGERMENT_KEY || '';
  const webhookTarget = env.FORM_WEBHOOK_TARGET || env.VITE_WEBHOOK_TARGET || 'https://n8n.samrulli.com';
  const webhookPath = env.FORM_WEBHOOK_PATH || env.VITE_WEBHOOK_PATH || '/webhook/9110a226-3600-4c44-91d8-84780a218c90';
  const proxyHeaders = user && key
    ? { Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}` }
    : undefined;

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: {
        '/api/inscricao': {
          target: webhookTarget,
          changeOrigin: true,
          rewrite: () => webhookPath,
          ...(proxyHeaders ? { headers: proxyHeaders } : {}),
        },
      },
    },
  };
});
