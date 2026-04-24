import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_PROXY_TARGET?.trim() || 'http://localhost:3001';

  if (command === 'build') {
    if (!env.VITE_API_BASE_URL?.trim()) {
      console.warn(
        '\n[whatsapp-frontend] VITE_API_BASE_URL ausente em .env.production — o bundle usará DEFAULT_PROD_API_BASE em src/lib/config.ts.\n'
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    preview: {
      host: true,
      port: parseInt(process.env.PORT ?? '4173', 10),
    },
    server: {
      port: 5173,
      // Só em `vite` (dev). `vite preview` não deve proxyar para localhost — senão /api quebra sem backend local.
      ...(command === 'serve' && mode === 'development'
        ? {
            proxy: {
              '/health': { target: apiTarget, changeOrigin: true },
              '/api': { target: apiTarget, changeOrigin: true },
            },
          }
        : {}),
    },
  };
});
