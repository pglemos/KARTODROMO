import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: { assetsDir: "booking-assets" },
  server: {
    host: "0.0.0.0",
    port: 5174,
    proxy: { "/api": "https://reservas.kartodromodebetim.com.br" },
  },
});
