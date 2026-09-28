import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // "/" ensures manifest/SW/assets resolve from origin root for PWA install
  // and SPA deep links (e.g. /chat/:id) resolve assets correctly. Capacitor
  // with `androidScheme: https` serves from https://localhost/ so "/" is fine.
  base: "/",
  plugins: [react()],
  server: {
    port: 5173
  }
});