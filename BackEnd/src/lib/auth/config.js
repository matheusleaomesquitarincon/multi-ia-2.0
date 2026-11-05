// Endereço do Supabase e chave pública (publishable). Os dois podem ir para o navegador: quem protege os dados são as
// regras de acesso do banco (RLS), não o segredo da chave. A chave secreta fica em lib/runs/supabase-server.js.

/**
 * @typedef {{
 * url: string;
 * publishableKey: string;
 * }} SupabaseConfig
 */

/**
 * Devolve a configuração, ou null se faltar alguma variável no .env.local (o login fica indisponível).
 * @returns {SupabaseConfig | null}
 */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

/** Mensagem para a tela quando o login não está configurado neste computador. */
export const LOGIN_NOT_CONFIGURED =
  "O login ainda não está configurado neste computador (faltam as chaves do Supabase no .env.local).";
