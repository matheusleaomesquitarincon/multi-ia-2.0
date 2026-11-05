// O Supabase visto com a sessão de quem está logado (o "crachá"): SÓ do servidor. Tudo o que passa por aqui obedece às
// regras de acesso do banco, então uma consulta que esquecer de filtrar pela empresa continua vendo só o que pode.
// Um cliente novo a cada pedido, nunca reaproveitado entre pessoas.

import { createServerClient } from "@supabase/ssr";
import { cookieStore, requestContext } from "../../http/request-context.js";
import { supabaseConfig } from "./config.js";

/**
 * Como o cookie do login é gravado. httpOnly: o navegador nunca lê o cookie por JavaScript (o front não fala com o
 * Supabase, só com o nosso servidor). SameSite=Lax: outro site não consegue mandar formulários com ele.
 */
const COOKIE_OPTIONS = { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" };

/**
 * O cliente com a sessão, só se há alguém logado (login conferido pela assinatura). Para rotas que só leem: as regras
 * do banco decidem o que a pessoa vê, sem precisar ler o cadastro dela antes.
 * @returns {Promise<SupabaseClient | null>}
 */
export async function signedInSession() {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ? supabase : null;
}

/**
 * Cria o cliente com o cookie do login. Devolve null se o login não estiver configurado neste computador.
 * @returns {Promise<SupabaseClient | null>}
 */
export async function createSessionClient() {
  const config = supabaseConfig();
  if (!config) return null;

  const store = cookieStore();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        // Cabeçalhos que impedem um intermediário de guardar a resposta com o login de alguém.
        for (const [key, value] of Object.entries(headers ?? {})) requestContext().outgoingHeaders.set(key, value);
      },
    },
  });
}
