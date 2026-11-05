// O cadastro da empresa acontece em dois tempos. No formulário, o Supabase Auth cria só o login, com o nome da empresa
// e do dono guardados junto ("metadados"). A empresa e o dono só nascem no banco no primeiro acesso, depois de o e-mail
// ser confirmado: assim um cadastro abandonado, ou feito com o e-mail de outra pessoa, não deixa empresa nenhuma.
// Quem cria é o servidor (chave secreta), porque pela sessão ninguém cria empresa nem pessoa (regras da migração 1).

import { supabaseAdmin } from "../runs/supabase-server.js";
import { NAME_MAX_CHARS, normalizeEmail } from "./forms.js";

/** Onde o nome da empresa e do dono ficam guardados no login, entre o cadastro e o primeiro acesso. */
export const SIGNUP_METADATA_KEY = "company_signup";

/**
 * @typedef {{
 * companyName: string;
 * ownerName: string;
 * }} PendingCompany
 */

/**
 * Monta o que vai junto do login no cadastro.
 * @param {PendingCompany} pending
 * @returns {Record<string, unknown>}
 */
export function signupMetadata(pending) {
  return { [SIGNUP_METADATA_KEY]: { company_name: pending.companyName, owner_name: pending.ownerName } };
}

function validName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= NAME_MAX_CHARS ? name : null;
}

/**
 * Lê o cadastro pendente guardado no login. O próprio usuário consegue mudar esses metadados, então eles são
 * conferidos de novo aqui (e só servem para criar a empresa uma vez, para ele mesmo).
 * @param {unknown} metadata
 * @returns {PendingCompany | null}
 */
export function pendingCompanyFrom(metadata) {
  if (typeof metadata !== "object" || metadata === null) return null;
  const signup = metadata[SIGNUP_METADATA_KEY];
  if (typeof signup !== "object" || signup === null) return null;
  const companyName = validName(signup.company_name);
  const ownerName = validName(signup.owner_name);
  return companyName && ownerName ? { companyName, ownerName } : null;
}

/**
 * @typedef {{
 * id: string;
 * email?: string;
 * user_metadata?: unknown;
 * }} SignedUpUser
 */

const UNIQUE_VIOLATION = "23505";

/**
 * Cria a empresa e o dono no primeiro acesso, se ainda não existirem. Pode ser chamada mais de uma vez (e até duas ao
 * mesmo tempo): a empresa nasce com o mesmo id do login do dono, então a segunda tentativa esbarra na mesma chave e
 * não deixa uma empresa sobrando. Se o primeiro acesso falhar no meio, o próximo termina o serviço.
 * Devolve "no-signup" para um login que não veio do cadastro de empresa (ex.: funcionário convidado).
 * @param {SignedUpUser} user
 * @returns {Promise<"exists" | "created" | "no-signup">}
 */
export async function ensureOwnerCompany(user) {
  const db = supabaseAdmin();

  const { data: existing, error: lookupError } = await db
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) throw new Error(`Não deu para procurar o cadastro: ${lookupError.message}`);
  if (existing) return "exists";

  const pending = pendingCompanyFrom(user.user_metadata);
  if (!pending || !user.email) return "no-signup";

  const { error: companyError } = await db
    .from("companies")
    .upsert({ id: user.id, name: pending.companyName }, { onConflict: "id", ignoreDuplicates: true });
  if (companyError) throw new Error(`Não deu para criar a empresa: ${companyError.message}`);

  const { error: memberError } = await db.from("members").insert({
    company_id: user.id,
    user_id: user.id,
    name: pending.ownerName,
    email: normalizeEmail(user.email),
    role: "owner",
  });
  // Outro pedido criou o dono no mesmo instante: está feito.
  if (memberError?.code === UNIQUE_VIOLATION) return "exists";
  if (memberError) throw new Error(`Não deu para criar o dono da empresa: ${memberError.message}`);
  return "created";
}
