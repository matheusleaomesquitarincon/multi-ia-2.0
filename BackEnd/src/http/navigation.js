// Sinais que uma função do servidor dá para encerrar o pedido: "mande a pessoa para outro lugar", "isto não existe" e
// "a tela precisa buscar os dados de novo". O adaptador (http/adapter.js) transforma cada um na resposta certa.

import { requestContext } from "./request-context.js";

export class RedirectSignal extends Error {
  constructor(path) {
    super(`Redirecionar para ${path}`);
    this.path = path;
  }
}

export class NotFoundSignal extends Error {
  constructor() {
    super("Não encontrado");
  }
}

/**
 * Encerra o pedido mandando a tela para outro endereço do site.
 * @param {string} path
 * @returns {never}
 */
export function redirect(path) {
  throw new RedirectSignal(path);
}

/** @returns {never} */
export function notFound() {
  throw new NotFoundSignal();
}

/** Avisa a tela de que os dados mudaram: ela busca de novo o que está mostrando. */
export function refresh() {
  requestContext().refresh = true;
}
