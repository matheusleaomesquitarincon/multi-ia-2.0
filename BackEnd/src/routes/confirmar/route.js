// GET /confirmar: para onde voltam os links dos e-mails do login.
// - Confirmação do cadastro (?code=...): o Supabase confirma o e-mail antes de mandar a pessoa para cá; aqui o código
//   vira o login (só funciona no mesmo navegador do cadastro) e, no primeiro acesso, a empresa nasce.
// - "Esqueci minha senha" (?tipo=recuperar&code=..., ou ?token_hash=...&type=recovery com o modelo de e-mail próprio,
//   que funciona em qualquer navegador): o link vira o login, a pessoa fica marcada como "precisa trocar a senha" e vai
//   criar a nova (F30).
// Qualquer outro caso (outro navegador, link vencido ou já usado) vai para "Entrar" com um aviso.

import { ensureOwnerCompany } from "../../lib/auth/company-signup.js";
import { markMustChangePassword } from "../../lib/auth/password-recovery.js";
import { createSessionClient } from "../../lib/auth/session.js";

/** Sempre um caminho do nosso site: nunca monta o destino a partir do que o pedido diz. */
const redirectTo = (path) => new Response(null, { status: 303, headers: { Location: path } });

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const recovery = params.get("tipo") === "recuperar" || params.get("type") === "recovery";
  const user = await signInFromLink(params);

  if (user) {
    await ensureOwnerCompany(user);
    if (!recovery) return redirectTo("/");
    await markMustChangePassword(user.id);
    return redirectTo("/trocar-senha?motivo=recuperar");
  }

  if (recovery) return redirectTo("/entrar?aviso=link-senha-vencido");
  const notice = params.get("error_code") === "otp_expired" ? "link-vencido" : "confirme";
  return redirectTo(`/entrar?aviso=${notice}`);
}

/**
 * Transforma o link do e-mail no login. Devolve a pessoa logada, ou null se o link não serviu.
 * @param {URLSearchParams} params
 */
async function signInFromLink(params) {
  const code = params.get("code");
  // O token_hash só vale para a recuperação de senha (o único modelo de e-mail próprio que usamos).
  const tokenHash = params.get("type") === "recovery" ? params.get("token_hash") : null;
  if (!code && !tokenHash) return null;

  const supabase = await createSessionClient();
  if (!supabase) return null;
  const result = tokenHash
    ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code);
  if (result.error) console.error("[confirmar] Link não aceito:", result.error.code);
  return result.data.user ?? null;
}
