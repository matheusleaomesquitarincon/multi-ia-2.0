// Limite de tempo das chamadas às IAs. Um servidor sempre ligado não encerra sozinho uma chamada travada, então o
// limite fica aqui: cada chamada tem um teto próprio e, além dele, o teto do pedido inteiro (runWithDeadline). Passou do
// tempo, a chamada falha como qualquer falha de rede: o motor tenta de novo, troca de IA ou pausa sem cobrar.

import { AsyncLocalStorage } from "node:async_hooks";

/** O máximo que uma única chamada a uma IA pode levar. */
export const AI_CALL_TIMEOUT_MS = 5 * 60 * 1000;

const storage = new AsyncLocalStorage();

/**
 * Roda `fn` com um teto de tempo para todas as chamadas às IAs feitas dentro dela.
 * @template T
 * @param {number} ms
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithDeadline(ms, fn) {
  return storage.run(AbortSignal.timeout(ms), fn);
}

/**
 * O sinal para uma chamada a uma IA: para quando a pessoa cancelar, a chamada passar do teto ou o pedido passar do dele.
 * @param {AbortSignal} [signal] O cancelamento da pessoa.
 * @returns {AbortSignal}
 */
export function callSignal(signal) {
  const deadline = storage.getStore();
  return AbortSignal.any([
    AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
    ...(deadline ? [deadline] : []),
    ...(signal ? [signal] : []),
  ]);
}
