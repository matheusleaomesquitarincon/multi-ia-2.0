// Renova o login a cada pedido, antes da rota (chamado por app.js). O login do Supabase vence em 1 hora; aqui ele é
// trocado por um novo e o cookie atualizado volta para o navegador. Não decide quem pode ver o quê: isso é conferido em
// cada rota (lib/auth/viewer.js), perto dos dados.

import { createSessionClient } from "./session.js";

export async function refreshSession() {
  const supabase = await createSessionClient();
  // Nada entre criar o cliente e esta linha: é ela que confere o login e, se ele estiver vencendo, o renova.
  if (supabase) await supabase.auth.getClaims();
}
