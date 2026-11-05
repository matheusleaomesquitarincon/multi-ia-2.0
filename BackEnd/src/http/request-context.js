// O pedido atual, disponível para qualquer função sem precisar passá-lo de mão em mão: os cookies do login, os
// cabeçalhos e o que vale só durante este pedido. Cada pedido tem o seu, nunca reaproveitado entre pessoas.

import { AsyncLocalStorage } from "node:async_hooks";
import { parseCookieHeader } from "@supabase/ssr";

const storage = new AsyncLocalStorage();

/**
 * Roda `fn` com o contexto de um pedido.
 * @param {Headers} headers
 * @param {() => unknown} fn
 */
export function runInRequest(headers, fn) {
  const context = {
    headers,
    cookies: parseCookieHeader(headers.get("cookie") ?? "").map(({ name, value }) => ({ name, value: value ?? "" })),
    /** Cookies a gravar no navegador, na resposta. */
    outgoingCookies: new Map(),
    /** Cabeçalhos pedidos pelo login (impedem intermediários de guardar a resposta). */
    outgoingHeaders: new Map(),
    cache: new Map(),
    refresh: false,
  };
  return storage.run(context, fn);
}

/** O contexto do pedido atual. Fora de um pedido, é um defeito no nosso código. */
export function requestContext() {
  const context = storage.getStore();
  if (!context) throw new Error("Esta função só pode rodar dentro de um pedido.");
  return context;
}

/** Os cabeçalhos do pedido atual. */
export function requestHeaders() {
  return requestContext().headers;
}

/** Os cookies do pedido atual, com o que já foi gravado durante ele. */
export function cookieStore() {
  const context = requestContext();
  return {
    getAll: () => context.cookies,
    set(name, value, options) {
      context.cookies = [...context.cookies.filter((cookie) => cookie.name !== name), { name, value }];
      context.outgoingCookies.set(name, { value, options });
    },
  };
}

/**
 * Guarda o resultado durante o pedido: o topo e a página, no mesmo pedido, consultam o banco uma vez só.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} load
 * @returns {Promise<T>}
 */
export function cachedInRequest(key, load) {
  const context = requestContext();
  if (!context.cache.has(key)) context.cache.set(key, load());
  return context.cache.get(key);
}
