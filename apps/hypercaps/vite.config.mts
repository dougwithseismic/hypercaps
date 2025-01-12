import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";

console.log("vite.config.mts");

// https://vitejs.dev/config/
export default defineConfig(async () => {
  console.log("vite.config.mts");
  const tsConfigPathsPlugin = await tsconfigPaths();

  return {
    plugins: [
      react(),
      tsConfigPathsPlugin,
      electron([
        {
          entry: "electron/main.ts",
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              sourcemap: true,
              outDir: "dist-electron/main",
            },
          },
        },
        {
          entry: "electron/preload.ts",
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              sourcemap: true,
              outDir: "dist-electron/preload",
            },
          },
        },
      ]),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        "@electron": resolve(__dirname, "./electron"),
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    server: {
      watch: {
        usePolling: true,
      },
      hmr: {
        overlay: true,
      },
    },
  };
});
