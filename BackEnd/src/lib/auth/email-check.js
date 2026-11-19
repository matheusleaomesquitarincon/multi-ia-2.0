// Confirmar o e-mail da pessoa logada (F32, parte 1): ela pede um código de 6 dígitos, que o Supabase manda para o
// e-mail do login (modelo "magic link", com {{ .Token }}), e digita na tela. O código não dá a ninguém um poder novo:
// quem lê aquele e-mail já consegue entrar pelo "Esqueci minha senha".
// A conferência usa um cliente à parte, sem cookie: o código vira uma sessão só para provar que estava certo, e essa
// sessão é encerrada na hora. O login de quem está no navegador não muda.
// SÓ do servidor.

import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../runs/supabase-server.js";
import { supabaseConfig } from "./config.js";

/** O código tem 6 dígitos (otp_length do Supabase). */
export const EMAIL_CODE_PATTERN = /^\d{6}$/;

function standaloneClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Login não configurado.");
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
}

/**
 * Manda o código para o e-mail. Devolve "sent", ou "too-soon" se a pessoa pediu há menos de um minuto.
 * @param {string} email
 * @returns {Promise<"sent" | "too-soon">}
 */
export async function sendEmailCode(email) {
  const { error } = await standaloneClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (!error) return "sent";
  if (error.code === "over_email_send_rate_limit" || error.status === 429) return "too-soon";
  throw new Error(`Não deu para mandar o código: ${error.code ?? error.status}`);
}

/**
 * Confere o código. Só vale se ele for do mesmo login que está pedindo (`userId`). Devolve se confirmou.
 * @param {{ userId: string; email: string; code: string }} input
 * @returns {Promise<boolean>}
 */
export async function verifyEmailCode(input) {
  if (!EMAIL_CODE_PATTERN.test(input.code)) return false;
  const client = standaloneClient();
  const { data, error } = await client.auth.verifyOtp({ email: input.email, token: input.code, type: "email" });
  if (error || !data.user) return false;
  // A sessão criada pelo código não serve para nada: encerra.
  const { error: signOutError } = await client.auth.signOut({ scope: "local" });
  if (signOutError) console.error("[e-mail] Sobrou a sessão do código:", signOutError.code);
  return data.user.id === input.userId;
}

/**
 * Marca o e-mail da pessoa como confirmado.
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function markEmailVerified(memberId) {
  const { error } = await supabaseAdmin()
    .from("members")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) throw new Error(`Não deu para marcar o e-mail: ${error.message}`);
}
