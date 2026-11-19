// Conferência dos formulários do painel interno da plataforma: recarga de uma empresa e câmbio. Roda no servidor; o
// banco confere de novo (platform_topup e platform_set_usd_to_brl). Só funções puras.

import { cleanName, text } from "../auth/forms.js";
import { USD_TO_BRL_MAX, USD_TO_BRL_MIN } from "../ock/pricing.js";
import { parseMemberId, parseTopupAmount } from "../ock/team-forms.js";

/** Maior recarga por vez pelo painel: R$ 100.000,00 (o mesmo limite do banco). */
export const PLATFORM_TOPUP_MAX_CENTS = 10_000_000;
export const TOPUP_DESCRIPTION_MAX_CHARS = 120;

// "5,65", "5.65", "5,6512": de 1 a 4 casas depois da vírgula.
const RATE_PATTERN = /^(\d{1,2})(?:[.,](\d{1,4}))?$/;

/**
 * @typedef {| { ok: true; companyId: string; cents: number; description: string }
 * | { ok: false; message: string }} PlatformTopupForm
 */

/**
 * @param {FormData} formData
 * @returns {PlatformTopupForm}
 */
export function parsePlatformTopup(formData) {
  const companyId = parseMemberId(formData, "companyId");
  if (!companyId) return { ok: false, message: "Escolha a empresa." };
  const amount = parseTopupAmount(text(formData, "amount"));
  if (!amount.ok) return { ok: false, message: amount.message };
  if (amount.cents > PLATFORM_TOPUP_MAX_CENTS) return { ok: false, message: "O máximo por recarga é R$ 100.000,00." };
  const description = cleanName(text(formData, "description"));
  if (!description) return { ok: false, message: "Escreva de onde veio o dinheiro, como \"Pix de 18/11\"." };
  if (description.length > TOPUP_DESCRIPTION_MAX_CHARS) {
    return { ok: false, message: `Use até ${TOPUP_DESCRIPTION_MAX_CHARS} caracteres na descrição.` };
  }
  return { ok: true, companyId, cents: amount.cents, description };
}

/**
 * O câmbio digitado, em reais por dólar.
 * @param {string} raw
 * @returns {{ ok: true; rate: number } | { ok: false; message: string }}
 */
export function parseExchangeRate(raw) {
  const value = raw.replace(/^\s*R\$/i, "").replace(/\s/g, "");
  const match = RATE_PATTERN.exec(value);
  if (!match) return { ok: false, message: "Use só números, como 5,65." };
  const rate = Number(`${match[1]}.${match[2] ?? "0"}`);
  if (rate < USD_TO_BRL_MIN || rate > USD_TO_BRL_MAX) {
    return { ok: false, message: `O câmbio precisa ficar entre R$ ${USD_TO_BRL_MIN} e R$ ${USD_TO_BRL_MAX}.` };
  }
  return { ok: true, rate };
}
