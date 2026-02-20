import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  server: {
    port: 8080,
    host: '0.0.0.0',
    strictPort: false,
    hmr: {
      clientPort: 8080
    },
    proxy: {
      // Proxy auth requests to Next.js platform (port 3003) in development
      // In production, these routes are served by the Next.js app directly
      '/api/auth/direct': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
      },
      '/api/admin/direct': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
      },
      '/api/auth/forgot-password': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
      },
      '/api/admin/setup-users': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
      },
    }
  },
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(''),
    'process.env.GEMINI_API_KEY': JSON.stringify(''),
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    '__DEFINES__': '{}'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    sourcemap: true,
  }
});
