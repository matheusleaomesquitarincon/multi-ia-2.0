// "Esqueci minha senha" (F30): manda para o e-mail um link que faz o login e leva à tela de criar a senha nova
// (routes/confirmar/route.js, com tipo=recuperar). Vale para o dono e para o funcionário.
// A resposta é sempre a mesma, exista ou não uma conta com o e-mail: assim ninguém usa esta tela para descobrir quem
// tem conta. Só o excesso de tentativas aparece, porque aí a pessoa precisa esperar.

import { LOGIN_NOT_CONFIGURED } from "../../lib/auth/config.js";
import { parseForgotPassword } from "../../lib/auth/forms.js";
import { passwordResetErrorMessage } from "../../lib/auth/messages.js";
import { createSessionClient } from "../../lib/auth/session.js";
import { siteOrigin } from "../../lib/auth/site-origin.js";

/** O endereço para onde o link do e-mail volta. */
export const RECOVERY_PATH = "/confirmar?tipo=recuperar";

/**
 * @typedef {| { status: "idle" }
 * | { status: "invalid"; errors: { email?: string }; values: { email: string } }
 * | { status: "error"; message: string; values: { email: string } }
 * | { status: "check-email"; email: string }} ForgotPasswordState
 */

/**
 * @param {ForgotPasswordState} _previous
 * @param {FormData} formData
 * @returns {Promise<ForgotPasswordState>}
 */
export async function requestPasswordReset(_previous, formData) {
  const parsed = parseForgotPassword(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const { email } = parsed.values;
  const supabase = await createSessionClient();
  if (!supabase) return { status: "error", message: LOGIN_NOT_CONFIGURED, values: { email } };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}${RECOVERY_PATH}`,
  });
  if (error) {
    const message = passwordResetErrorMessage(error.code);
    if (message) return { status: "error", message, values: { email } };
    // Qualquer outro erro: registra só o código (nunca o e-mail) e responde como se tivesse mandado.
    console.error("[esqueci-senha] O Supabase recusou o envio:", error.code, error.status);
  }
  return { status: "check-email", email };
}
