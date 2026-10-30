import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 8181, strictPort: true },
  preview: { port: 8181, strictPort: true },
});
