import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Bake the current git commit hash into the build at compile time
const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig({
  base: './',
  server: {
    port: 8080,
    host: '0.0.0.0',
    strictPort: false,
    hmr: {
      clientPort: 8080
    }
  },
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(''),
    'process.env.GEMINI_API_KEY': JSON.stringify(''),
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    '__DEFINES__': '{}',
    '__COMMIT_HASH__': JSON.stringify(commitHash)
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
