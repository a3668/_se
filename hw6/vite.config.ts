import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ollamaProxy } from './server/ollamaProxy';

export default defineConfig({
  plugins: [react(), ollamaProxy()],
  server: { host: '127.0.0.1', port: 6060, strictPort: true },
  preview: { host: '127.0.0.1', port: 6060, strictPort: true },
});
