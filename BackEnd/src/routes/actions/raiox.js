// A ação da visão raio-x: entra como uma das contas de teste (Chefe ou Funcionário) com um clique. SÓ do servidor e
// SÓ no modo raio-x (local). Reaproveita o login de verdade (signInWithPassword), então tudo depois disso é real:
// as regras de acesso, a carteira e o chat funcionam igual.

import { notFound, redirect } from "../../http/navigation.js";
import { DEMO_ACCOUNTS, isDemoMode, isDemoView } from "../../lib/auth/demo.js";
import { homePathFor } from "../../lib/auth/member.js";
import { createSessionClient } from "../../lib/auth/session.js";

/**
 * @param {DemoView} view
 * @returns {Promise<void>}
 */
export async function entrarComoDemo(view) {
  // Fora do modo raio-x (ou com um valor estranho), esta rota nem existe.
  if (!isDemoMode() || !isDemoView(view)) notFound();
  const account = DEMO_ACCOUNTS[view];

  const supabase = await createSessionClient();
  if (!supabase) notFound();

  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) {
    throw new Error(`Não deu para entrar na visão raio-x (${view}): ${error.message}`);
  }

  redirect(homePathFor(account.role));
}
