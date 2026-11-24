import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const rootDirectory = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const { API_PORT: apiPort = '3000' } = loadEnv(mode, rootDirectory, 'API_PORT');
  const localServer = {
    host: '127.0.0.1',
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: localServer,
    preview: localServer,
  };
});
