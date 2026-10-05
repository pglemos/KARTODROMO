import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  define: { __BUILD_TIME__: Number(process.env.SITE_BUILD_TIME || Date.now()) },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://kartodromodebetim.com.br",
        changeOrigin: true,
      },
    },
  },
  build: { assetsDir: "ui-assets" },
});
