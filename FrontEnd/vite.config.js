import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const BACKEND = "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    // A mesma porta de sempre: é ela que está liberada nos links de e-mail do Supabase (BackEnd/supabase/config.toml).
    port: 3000,
    strictPort: true,
    // O navegador só conhece um endereço: os pedidos de dados são repassados ao BackEnd, com o Host original, para o
    // cookie do login e a conferência de origem funcionarem igual ao site publicado.
    proxy: {
      "/api": { target: BACKEND, changeOrigin: false },
      "/confirmar": { target: BACKEND, changeOrigin: false },
    },
    // A mesma regra que o BackEnd aplica no site publicado (AGENTS.md, seção 6).
    headers: { "Content-Security-Policy": "frame-src 'none'" },
  },
  test: {
    environment: "node",
    reporters: ["verbose"],
    include: ["src/**/*.test.js"],
  },
});
