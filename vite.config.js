import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/evidence': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/pipeline': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/review': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/export': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/outputs': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          jspdf: ['jspdf'],
          html2canvas: ['html2canvas'],
        },
      },
    },
  },
});
