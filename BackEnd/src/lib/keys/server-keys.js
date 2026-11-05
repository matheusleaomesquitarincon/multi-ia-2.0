// As chaves-mãe da PLATAFORMA (OCK), lidas SÓ do servidor (variáveis de ambiente da hospedagem).
// Toda empresa usa estas chaves; a OCK mede e trava por empresa e por funcionário no nosso banco.
// A empresa nunca conecta nem vê chave nenhuma. Nunca expor estes valores ao cliente nem em log.
// Só valem com as IAs de verdade ligadas (OCK_AI_MODE, lib/providers/mode.js).

import { demoKeys } from "./demo-keys.js";

/** O nome da variável de ambiente com a chave de cada IA (vai no aviso do servidor quando falta, nunca o valor). */
export const KEY_ENV_NAMES = {
  claude: "OCK_CLAUDE_KEY",
  gpt: "OCK_GPT_KEY",
  gemini: "OCK_GEMINI_KEY",
};

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {ProviderKeys}
 */
export function serverKeys(env = process.env) {
  const keys = {};
  for (const [id, name] of Object.entries(KEY_ENV_NAMES)) {
    const value = env[name]?.trim();
    if (value) keys[id] = value;
  }
  // No modo raio-x, as chaves coladas na tela (arquivo local, fora do Git) preenchem o que faltar no ambiente.
  for (const [id, value] of Object.entries(demoKeys())) {
    if (!keys[id]) keys[id] = value;
  }
  return keys;
}
