import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      projects: [resolve(__dirname, 'tsconfig.json')],
    }),
    TanStackRouterVite({
      generatedRouteTree: './routes/route-tree.gen.ts',
      routesDirectory: './routes',
      routeFileIgnorePattern: '.*\\.(css|test).*',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  base: '',
  build: {
    sourcemap: true,
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      usePolling: true,
      ignored: ['!**/node_modules/**'],
    },
    hmr: {
      overlay: true,
    },
  },
});
