import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  return {
    plugins: [
      react(),
      tsconfigPaths({
        projects: [resolve(__dirname, 'tsconfig.json')],
      }),
      TanStackRouterVite({
        generatedRouteTree: './src/routeTree.gen.ts',
        routesDirectory: './src/routes',
        routeFileIgnorePattern: '.*\\.(css|test).*',
      }),
      electron([
        {
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              sourcemap: true,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: ['@hypercaps/keyboard-monitor'],
              },
            },
            resolve: {
              alias: {
                '@': resolve(__dirname, 'src'),
                '@electron': resolve(__dirname, 'electron'),
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              sourcemap: true,
              outDir: 'dist-electron/preload',
            },
            resolve: {
              alias: {
                '@': resolve(__dirname, 'src'),
                '@electron': resolve(__dirname, 'electron'),
              },
            },
          },
        },
      ]),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@electron': resolve(__dirname, 'electron'),
      },
    },
    base: '',
    build: {
      sourcemap: true,
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
        external: ['@hypercaps/keyboard-monitor'],
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: true,
        ignored: ['!**/node_modules/**'],
      },
      hmr: {
        overlay: true,
      },
    },
  };
});
