// Entrega a IA pronta para uso. Só o servidor deve usar este arquivo: é aqui que as IAs reais recebem as chaves da
// plataforma (lib/keys/server-keys.ts). A empresa nunca conecta chave própria (decisão de 24/10/2026).

import { KEY_ENV_NAMES, serverKeys } from "../keys/server-keys.js";
import { getProviderInfo } from "./catalog.js";
import { createMockImageGenerator, createOpenAiImageGenerator } from "./images.js";
import { createMockProvider, parseMockFailures, parseMockOverspend } from "./mock.js";
import { createMockTranscriber, createOpenAiTranscriber } from "./transcribe.js";
import { aiMode } from "./mode.js";
import { createRealProvider } from "./real.js";
import { ProviderError } from "./types.js";

/** Nas falhas de teste, a IA simulada escreve um pouco antes de cair, como uma conexão que cai no meio da resposta. */
const TEST_FAILURE_AFTER_CHUNKS = 12;

/** Chaves da plataforma, por IA. */
/** @typedef {Partial<Record<ProviderId, string>>} ProviderKeys */

/**
 * Quem entrega as IAs no servidor (receitas e chat): as de verdade ou as simuladas, conforme o interruptor
 * OCK_AI_MODE (lib/providers/mode.ts). O interruptor é lido a cada chamada: o `npm run dev` percebe a mudança no
 * .env.local sem reiniciar.
 * @param {ProviderId} id
 * @returns {AiProvider}
 */
export function getProvider(id) {
  return aiMode() === "simulada" ? getSimulatedProvider(id) : createGetProvider(serverKeys())(id);
}

/**
 * A IA simulada, com os interruptores de teste MOCK_AI_FAILURES e MOCK_AI_OVERSPEND (veja .env.example).
 * @param {ProviderId} id
 * @returns {AiProvider}
 */
export function getSimulatedProvider(id) {
  const failures = parseMockFailures(process.env.MOCK_AI_FAILURES);
  return createMockProvider({
    id,
    failFirstCalls: failures[id] ?? 0,
    failAfterChunks: TEST_FAILURE_AFTER_CHUNKS,
    overspend: parseMockOverspend(process.env.MOCK_AI_OVERSPEND).has(id),
  });
}

/**
 * As IAs de verdade, com estas chaves. A IA sem chave nunca cai na simulada (F42): ela falha com um erro que não
 * adianta repetir, a troca de IA entra (nas receitas) e o servidor registra qual variável falta. Nada é cobrado.
 * @param {ProviderKeys} keys
 * @returns {(id: ProviderId) => AiProvider}
 */
export function createGetProvider(keys) {
  return (id) => {
    const key = keys[id]?.trim();
    return key ? createRealProvider(id, key) : missingKeyProvider(id);
  };
}

function missingKeyProvider(id) {
  const problem = new ProviderError(
    `A chave do ${getProviderInfo(id).name} não está configurada no servidor (${KEY_ENV_NAMES[id]}).`,
    { retryable: false },
  );
  return {
    id,
    generate: () => ({
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(problem) }),
    }),
  };
}

/**
 * Quem cria as imagens (o GPT Image), pelo mesmo interruptor das IAs: simulada ou de verdade. Sem a chave do GPT, falha
 * com um erro que não adianta repetir, como as IAs de texto (F42).
 * @returns {ImageGenerator}
 */
export function getImageGenerator() {
  if (aiMode() === "simulada") return createMockImageGenerator();
  const key = serverKeys().gpt?.trim();
  if (key) return createOpenAiImageGenerator(key);
  return {
    generate: () =>
      Promise.reject(
        new ProviderError(`A chave do GPT não está configurada no servidor (${KEY_ENV_NAMES.gpt}).`, {
          retryable: false,
        }),
      ),
  };
}

/**
 * Quem transcreve a voz (o gpt-transcribe), pelo mesmo interruptor das IAs. Sem a chave do GPT, falha (F42).
 * @returns {Transcriber}
 */
export function getTranscriber() {
  if (aiMode() === "simulada") return createMockTranscriber();
  const key = serverKeys().gpt?.trim();
  if (key) return createOpenAiTranscriber(key);
  return {
    transcribe: () =>
      Promise.reject(
        new ProviderError(`A chave do GPT não está configurada no servidor (${KEY_ENV_NAMES.gpt}).`, {
          retryable: false,
        }),
      ),
  };
}
