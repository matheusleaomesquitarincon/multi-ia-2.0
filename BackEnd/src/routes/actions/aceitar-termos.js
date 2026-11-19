// Aceitar os termos de uso e a política de privacidade (F05), para quem já tinha conta antes deles ou quando a versão
// muda (TERMS_VERSION). Quem entra pelo cadastro, pelo convite ou pela senha temporária aceita no próprio formulário.

import { redirect } from "../../http/navigation.js";
import { acceptedTerms, TERMS_REQUIRED } from "../../lib/auth/forms.js";
import { homePathFor } from "../../lib/auth/member.js";
import { recordTermsAcceptance } from "../../lib/auth/terms.js";
import { getViewer } from "../../lib/auth/viewer.js";

/**
 * @param {{ status: string }} _previous
 * @param {FormData} formData
 * @returns {Promise<{ status: "invalid"; errors: { acceptTerms: string } } | { status: "error"; message: string }>}
 */
export async function acceptTermsAction(_previous, formData) {
  const viewer = await getViewer();
  if (viewer.status !== "member") redirect("/entrar");
  const me = viewer.member;
  if (!me.needsTerms) redirect(homePathFor(me.role));
  if (!acceptedTerms(formData)) return { status: "invalid", errors: { acceptTerms: TERMS_REQUIRED } };

  try {
    await recordTermsAcceptance({ memberId: me.id });
  } catch (error) {
    console.error("[aceitar-termos]", error instanceof Error ? error.message : error);
    return { status: "error", message: "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes." };
  }
  redirect(me.mustChangePassword ? "/trocar-senha" : homePathFor(me.role));
}
