import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";
import pkg from "./package.json";

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [tailwindcss(), react()],
  // Cada cliente entra por su subdominio: acme.localhost:5006 en local.
  server: { allowedHosts: [".localhost"] },
  // Producción: bundle minificado, CSS dividido y precarga de módulos. En dev se
  // mantiene el build sin minificar/segmentar para que el HMR sea rápido.
  build:
    mode === "production"
      ? {
          target: "esnext",
          minify: "esbuild",
          cssCodeSplit: true,
          modulePreload: { polyfill: true },
          sourcemap: false,
        }
      : {
          modulePreload: false,
          target: "esnext",
          minify: false,
          cssCodeSplit: false,
        },
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "./src/app"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@entities": path.resolve(__dirname, "./src/entities"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@widgets": path.resolve(__dirname, "./src/widgets"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
}));
