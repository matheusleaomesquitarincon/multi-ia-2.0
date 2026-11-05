// O servidor: o pedido passa pela conferência de origem, renova o login e chega à rota. No site publicado ele também
// entrega as telas já montadas (FrontEnd/dist), para tudo ficar num endereço só e o cookie do login valer sem exceções.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { originCheck } from "./http/origin-check.js";
import { runInRequest } from "./http/request-context.js";
import { refreshSession } from "./lib/auth/refresh-session.js";
import { apiRoutes } from "./routes/index.js";

const DEFAULT_DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "FrontEnd", "dist");

function securityHeaders(_req, res, next) {
  // Nenhuma moldura das nossas páginas pode carregar outro endereço. A prévia do site feito pelas IAs vai escrita direto
  // na moldura e continua funcionando; se o código dela tentar levar a moldura para outro site (e mandar dados junto),
  // o navegador bloqueia (AGENTS.md, seção 6).
  res.setHeader("Content-Security-Policy", "frame-src 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}

/** Cria o contexto do pedido e renova o login antes da rota. Falha aqui não derruba o pedido: a rota decide. */
function requestScope(req, _res, next) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  runInRequest(headers, async () => {
    try {
      await refreshSession();
    } catch (error) {
      console.error("[login] Não deu para renovar o login:", error instanceof Error ? error.message : error);
    }
    next();
  });
}

/**
 * @param {{ distDir?: string }} [options]
 */
export function createApp(options = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);

  const backend = express.Router();
  backend.use(originCheck, requestScope, apiRoutes());
  backend.use("/api", (_req, res) => res.status(404).json({ problem: "Endereço não encontrado." }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/api" || req.path === "/confirmar") backend(req, res, next);
    else next();
  });

  const distDir = options.distDir ?? process.env.FRONTEND_DIST ?? DEFAULT_DIST;
  if (existsSync(join(distDir, "index.html"))) {
    app.use(express.static(distDir, { index: false }));
    app.get(/.*/, (req, res) => {
      // O código do convite está no endereço: não vai para outros sites nem para buscadores.
      if (req.path.startsWith("/convite/")) {
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      }
      res.sendFile(join(distDir, "index.html"));
    });
  }

  // Erro inesperado: a mensagem técnica fica no registro do servidor, nunca na resposta.
  app.use((error, _req, res, next) => {
    console.error("[servidor] Erro inesperado:", error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ problem: "Algo deu errado do nosso lado. Tente de novo daqui a pouco." });
  });

  return app;
}
