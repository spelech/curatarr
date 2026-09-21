import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8045',
        changeOrigin: true
      },
      '/mcp': {
        target: 'http://localhost:8045',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../Curatarr.Api/wwwroot',
    emptyOutDir: true
  }
});
