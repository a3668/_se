import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ollamaProxy } from './server/ollamaProxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), ollamaProxy()],
    define: {
      __OLLAMA_BASE_URL__: JSON.stringify(env.OLLAMA_BASE_URL || 'http://localhost:11434'),
      __OLLAMA_MODEL__: JSON.stringify(env.OLLAMA_MODEL || 'gpt-oss:120b-cloud'),
    },
    server: { host: '127.0.0.1', port: 6060, strictPort: true },
    preview: { host: '127.0.0.1', port: 6060, strictPort: true },
  };
});
