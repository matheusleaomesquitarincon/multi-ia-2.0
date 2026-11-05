// Lista das IAs que o usuário pode escolher. Só dados (sem chaves nem chamadas),
// por isso pode ser usada também pelas telas.

/**
 * @typedef {{
 * id: ProviderId;
 * // Nome mostrado na tela. A cor de cada IA fica em styles/tokens.css (--color-ai-<id>).
 * name: string;
 * }} ProviderInfo
 */

export const PROVIDERS = [
  { id: "claude", name: "Claude" },
  { id: "gpt", name: "GPT" },
  { id: "gemini", name: "Gemini" },
];

/**
 * @param {unknown} value
 * @returns {value is ProviderId}
 */
export function isProviderId(value) {
  return PROVIDERS.some((provider) => provider.id === value);
}

/**
 * @param {ProviderId} id
 * @returns {ProviderInfo}
 */
export function getProviderInfo(id) {
  const info = PROVIDERS.find((provider) => provider.id === id);
  if (!info) throw new Error(`IA desconhecida: ${id}`);
  return info;
}
