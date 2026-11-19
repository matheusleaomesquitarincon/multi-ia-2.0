// Confirmar o e-mail da pessoa logada (F32, parte 1): pedir o código e conferir o código. Quem pede é sempre a própria
// pessoa, pelo login; o e-mail vem do cadastro dela, nunca do formulário.

import { refresh, redirect } from "../../http/navigation.js";
import { text } from "../../lib/auth/forms.js";
import { EMAIL_CODE_PATTERN, markEmailVerified, sendEmailCode, verifyEmailCode } from "../../lib/auth/email-check.js";
import { getUserId, getViewer } from "../../lib/auth/viewer.js";

const GENERIC = "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes.";

/** @typedef {{ status: "idle" | "sent" | "verified" } | { status: "error"; message: string }} EmailCheckState */

async function currentMember() {
  const viewer = await getViewer();
  if (viewer.status !== "member") redirect("/entrar");
  return viewer.member;
}

/**
 * @param {EmailCheckState} _previous
 * @returns {Promise<EmailCheckState>}
 */
export async function sendEmailCodeAction(_previous) {
  const me = await currentMember();
  if (me.emailVerified) return { status: "verified" };
  try {
    const result = await sendEmailCode(me.email);
    if (result === "too-soon") {
      return { status: "error", message: "Já mandamos um código há pouco. Espere um minuto e peça de novo." };
    }
    return { status: "sent" };
  } catch (error) {
    console.error("[conta]", error instanceof Error ? error.message : error);
    return {
      status: "error",
      message: "Não deu para mandar o e-mail agora. Se continuar, avise o dono da empresa.",
    };
  }
}

/**
 * @param {EmailCheckState} _previous
 * @param {FormData} formData
 * @returns {Promise<EmailCheckState>}
 */
export async function verifyEmailCodeAction(_previous, formData) {
  const me = await currentMember();
  if (me.emailVerified) return { status: "verified" };
  const code = text(formData, "code").replace(/\s/g, "");
  if (!EMAIL_CODE_PATTERN.test(code)) {
    return { status: "error", message: "O código tem 6 números. Confira no e-mail e digite de novo." };
  }
  const userId = await getUserId();
  if (!userId) redirect("/entrar");
  try {
    if (!(await verifyEmailCode({ userId, email: me.email, code }))) {
      return { status: "error", message: "Esse código não está certo ou já venceu. Peça um novo." };
    }
    await markEmailVerified(me.id);
  } catch (error) {
    console.error("[conta]", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC };
  }
  refresh();
  return { status: "verified" };
}
