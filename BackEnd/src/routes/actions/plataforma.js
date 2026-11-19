// As ações do painel interno da plataforma: recarregar uma empresa e mudar o câmbio. Só para a equipe; o banco confere
// de novo, pelo login de quem pede (migração 20261118130000_platform_panel.sql).

import { refresh } from "../../http/navigation.js";
import { formatBRL, setUsdToBrl } from "../../lib/ock/pricing.js";
import { text } from "../../lib/auth/forms.js";
import { parseExchangeRate, parsePlatformTopup } from "../../lib/platform/forms.js";
import { requireStaffSession } from "../../lib/platform/panel.js";

const GENERIC = "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes.";

/** O que o banco recusa, em português. */
const REFUSED = {
  invalid_amount: "O valor precisa ser maior que zero e de até R$ 100.000,00.",
  invalid_description: "Escreva de onde veio o dinheiro, com até 120 caracteres.",
  company_not_found: "Essa empresa não existe mais.",
  invalid_rate: "O câmbio precisa ficar entre R$ 1 e R$ 20.",
  not_staff: "Só a equipe da plataforma pode fazer isso.",
};

function refusal(error) {
  const code = Object.keys(REFUSED).find((key) => error.message?.includes(key));
  return code ? REFUSED[code] : null;
}

/**
 * @typedef {{ status: "idle" } | { status: "done"; message: string } | { status: "error"; message: string }} PlatformState
 */

/**
 * @param {PlatformState} _previous
 * @param {FormData} formData
 * @returns {Promise<PlatformState>}
 */
export async function platformTopupAction(_previous, formData) {
  const session = await requireStaffSession();
  const form = parsePlatformTopup(formData);
  if (!form.ok) return { status: "error", message: form.message };

  const { data, error } = await session.rpc("platform_topup", {
    p_company_id: form.companyId,
    p_amount_cents: form.cents,
    p_description: form.description,
  });
  if (error) {
    const message = refusal(error);
    if (!message) console.error("[plataforma] A recarga falhou:", error.message);
    return { status: "error", message: message ?? GENERIC };
  }
  refresh();
  return {
    status: "done",
    message: `Recarga de ${formatBRL(form.cents)} feita. Saldo da empresa agora: ${formatBRL(Number(data))}.`,
  };
}

/**
 * @param {PlatformState} _previous
 * @param {FormData} formData
 * @returns {Promise<PlatformState>}
 */
export async function platformExchangeAction(_previous, formData) {
  const session = await requireStaffSession();
  const parsed = parseExchangeRate(text(formData, "rate"));
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const { data, error } = await session.rpc("platform_set_usd_to_brl", { p_usd_to_brl: parsed.rate });
  if (error) {
    const message = refusal(error);
    if (!message) console.error("[plataforma] A troca do câmbio falhou:", error.message);
    return { status: "error", message: message ?? GENERIC };
  }
  // Este servidor já passa a cobrar no câmbio novo; os outros leem na próxima rodada da limpeza (até 5 minutos).
  setUsdToBrl(Number(data));
  refresh();
  const rate = Number(data).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return { status: "done", message: `Câmbio salvo: R$ ${rate} por dólar.` };
}
