import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const ENV_PREFIX = "IMJS_";

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    build: {
      chunkSizeWarningLimit: 8000, // Increase chunk size warning limit to avoid warnings for large chunks
    },
    plugins: [
      tailwindcss(),
      react(),
      viteStaticCopy({
        targets: [
          {
            // copy assets from `@itwin` dependencies
            src: "./node_modules/**/@itwin/*/lib/public/*",
            dest: ".",
          },
        ],
      }),
    ],
    server: {
      port: 3000,
      host: "0.0.0.0",
      strictPort: false,
      open: false,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    resolve: {
      alias: [
        {
          // Resolve SASS tilde imports.
          find: /^~(.*)$/,
          replacement: "$1",
        },
        {
          find: "react-beautiful-dnd",
          replacement: "@hello-pangea/dnd",
        },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          loadPaths: ["node_modules"],
        },
      },
    },
    optimizeDeps: {
      include: [
        "fuse.js",
        "wms-capabilities",
        "@loaders.gl/core",
        "@loaders.gl/draco"
      ],
    },
    envPrefix: ENV_PREFIX
  };
});
