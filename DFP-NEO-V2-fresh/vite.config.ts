import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Bake the current git commit hash into the build at compile time
// Railway provides RAILWAY_GIT_COMMIT_SHA env var during build
const commitHash = (() => {
  // 1. Try Railway's env var first (available in Railway CI builds)
  if (process.env.RAILWAY_GIT_COMMIT_SHA) {
    return process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 8);
  }
  // 2. Try generic GIT_COMMIT env var
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT.substring(0, 8);
  }
  // 3. Fall back to git command (works locally)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git';
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
    // Disable identifier mangling to prevent TDZ name collision bugs.
    // Variable/function names are kept as-is; only whitespace/dead code is removed.
    // The bundle is served over HTTPS with gzip so size is still acceptable.
    minify: false,
    rollupOptions: {
      output: {
        // Fixed filenames prevent hash mismatch between local build and Railway build.
        // Railway rebuilds from source so the commit hash baked in differs, changing
        // the content hash and therefore the filename. Using fixed names ensures
        // index.html always references the correct bundle regardless of build environment.
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          // React and React-DOM in their own isolated chunk
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // jsPDF and html2canvas in their own chunk
          if (id.includes('node_modules/jspdf') || 
              id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
        },
      },
    },
  }
});
