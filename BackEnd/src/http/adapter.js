// Liga o Express às rotas do projeto. Cada rota é uma função que recebe um Request e devolve um Response (os mesmos da
// plataforma web), então nenhuma regra de negócio conhece o Express.

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { serializeCookieHeader } from "@supabase/ssr";
import { runWithDeadline } from "../lib/providers/deadline.js";
import { NotFoundSignal, RedirectSignal } from "./navigation.js";
import { requestContext } from "./request-context.js";

// O endereço do Request é fixo: as rotas só leem o caminho e os parâmetros. Assim um cabeçalho Host inventado por quem
// pede nunca vira link nem destino de nada (F39).
const INTERNAL_BASE = "http://app.internal";

const NO_STORE = { "Cache-Control": "no-store" };

/** Quanto, no máximo, as IAs podem usar dentro de um pedido de uma rota sem teto próprio, em segundos. */
const DEFAULT_MAX_DURATION = 300;

function toWebRequest(req) {
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(INTERNAL_BASE + req.originalUrl, {
    method: req.method,
    headers: requestContext().headers,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
  });
}

/**
 * @param {unknown} error
 * @returns {Response | null} A resposta de um sinal (redirecionar, não encontrado), ou null se for um erro de verdade.
 */
function signalResponse(error) {
  // 200 de propósito: é uma instrução para a tela, que confere o campo `redirect` antes de qualquer outra coisa.
  if (error instanceof RedirectSignal) return Response.json({ redirect: error.path }, { headers: NO_STORE });
  if (error instanceof NotFoundSignal) return Response.json({ notFound: true }, { status: 404, headers: NO_STORE });
  return null;
}

async function sendResponse(res, response) {
  const context = requestContext();
  res.status(response.status);
  for (const [name, value] of response.headers) {
    if (name === "set-cookie") res.append("Set-Cookie", value);
    else res.setHeader(name, value);
  }
  for (const [name, value] of context.outgoingHeaders) res.setHeader(name, value);
  for (const [name, { value, options }] of context.outgoingCookies) {
    res.append("Set-Cookie", serializeCookieHeader(name, value, options));
  }
  if (context.refresh) res.setHeader("X-Refresh-View", "1");
  if (!response.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body), res);
}

/**
 * Transforma uma rota do projeto em uma rota do Express.
 * @param {(request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> | Response} handler
 * @param {number} [maxDuration] Quanto as IAs podem usar neste pedido, em segundos.
 */
export function route(handler, maxDuration = DEFAULT_MAX_DURATION) {
  return async (req, res, next) => {
    try {
      const request = toWebRequest(req);
      let response;
      try {
        response = await runWithDeadline(maxDuration * 1000, () =>
          handler(request, { params: Promise.resolve({ ...req.params }) }),
        );
      } catch (error) {
        response = signalResponse(error);
        if (!response) throw error;
      }
      await sendResponse(res, response);
    } catch (error) {
      next(error);
    }
  };
}
