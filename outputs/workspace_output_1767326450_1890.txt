import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false,
    hmr: {
      clientPort: 5173
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
