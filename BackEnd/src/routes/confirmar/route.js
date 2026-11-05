// GET /confirmar?code=...: para onde volta o link do e-mail de confirmação do cadastro. O Supabase confirma o e-mail
// antes de mandar a pessoa para cá; aqui o código vira o login (só funciona no mesmo navegador do cadastro) e, no
// primeiro acesso, a empresa nasce. Qualquer outro caso (outro navegador, link vencido ou já usado) vai para "Entrar"
// com um aviso: se o e-mail já foi confirmado, basta entrar com a senha.

import { ensureOwnerCompany } from "../../lib/auth/company-signup.js";
import { createSessionClient } from "../../lib/auth/session.js";

/** Sempre um caminho do nosso site: nunca monta o destino a partir do que o pedido diz. */
const redirectTo = (path) => new Response(null, { status: 303, headers: { Location: path } });

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");

  if (code) {
    const supabase = await createSessionClient();
    const result = supabase ? await supabase.auth.exchangeCodeForSession(code) : null;
    if (result?.data.user) {
      await ensureOwnerCompany(result.data.user);
      return redirectTo("/");
    }
    if (result?.error) console.error("[confirmar] Código não aceito:", result.error.code);
  }

  const notice = params.get("error_code") === "otp_expired" ? "link-vencido" : "confirme";
  return redirectTo(`/entrar?aviso=${notice}`);
}
