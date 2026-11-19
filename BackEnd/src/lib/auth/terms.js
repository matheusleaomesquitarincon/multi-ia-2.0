// Grava o aceite dos termos de uso e da política de privacidade (F05). Quem grava é o servidor (chave-mestra): a sessão
// de quem está logado não muda essas colunas (migração 20261118120000_terms_acceptance.sql).

import { supabaseAdmin } from "../runs/supabase-server.js";
import { TERMS_VERSION } from "./forms.js";

/**
 * As colunas do aceite da versão atual, agora.
 * @param {Date} [now]
 * @returns {{ terms_version: string; terms_accepted_at: string }}
 */
export function termsAcceptance(now = new Date()) {
  return { terms_version: TERMS_VERSION, terms_accepted_at: now.toISOString() };
}

/**
 * Marca que a pessoa aceitou a versão atual dos termos, achada pelo login (`userId`) ou pelo cadastro (`memberId`).
 * @param {{ userId: string } | { memberId: string }} who
 * @returns {Promise<void>}
 */
export async function recordTermsAcceptance(who) {
  const [column, value] = "userId" in who ? ["user_id", who.userId] : ["id", who.memberId];
  const { error } = await supabaseAdmin().from("members").update(termsAcceptance()).eq(column, value);
  if (error) throw new Error(`Não deu para guardar o aceite dos termos: ${error.message}`);
}
