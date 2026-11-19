// A volta do "Esqueci minha senha" (F30). O link do e-mail já fez o login; aqui a pessoa fica marcada como "precisa
// trocar a senha", a mesma marca do primeiro acesso do funcionário. Assim, enquanto não criar a senha nova, qualquer
// página a leva para /trocar-senha (lib/auth/viewer.js), e a troca derruba os outros aparelhos dela.
// SÓ do servidor: a marca é gravada com a chave-mestra, porque a sessão não mexe na própria linha de membro.

import { supabaseAdmin } from "../runs/supabase-server.js";

/**
 * Marca o login como "precisa trocar a senha". Pessoa desativada não é marcada (ela nem entra).
 * @param {string} userId O id do login no Supabase Auth.
 * @returns {Promise<void>}
 */
export async function markMustChangePassword(userId) {
  const { error } = await supabaseAdmin()
    .from("members")
    .update({ must_change_password: true })
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
}
