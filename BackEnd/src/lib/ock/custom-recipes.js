// Os times de IA que os funcionários montam: as receitas próprias (F08), na tabela custom_recipes. SÓ do servidor.
// Tudo pela sessão de quem está logado: o banco devolve as da própria pessoa e as que alguém da empresa deixou para a
// empresa toda; mudar e apagar, só quem criou (ou o dono, nas da empresa). A empresa e o autor vêm do login.
// O formato é conferido de novo ao ler (parseCustomRecipe): pela sessão dá para gravar sem passar pelas nossas telas.

import { MAX_CUSTOM_RECIPES, parseCustomRecipe } from "../recipes/custom-form.js";

const TABLE = "custom_recipes";
const COLUMNS = "id, member_id, name, visibility, definition, updated_at";

/**
 * Um time salvo, já conferido.
 * @typedef {{
 * id: string;
 * // Se foi a própria pessoa que montou (só quem montou muda e apaga; o dono também, nos da empresa).
 * mine: boolean;
 * updatedAt: string;
 * form: CustomRecipeForm;
 * }} SavedCustomRecipe
 */

/**
 * @param {{ id: string; member_id: string; name: string; visibility: string; definition: unknown; updated_at: string }} row
 * @param {string} memberId
 * @returns {SavedCustomRecipe | null}
 */
function toSaved(row, memberId) {
  const definition = /** @type {{ members?: unknown }} */ (row.definition ?? {});
  const parsed = parseCustomRecipe({ name: row.name, visibility: row.visibility, members: definition.members });
  if (!parsed.ok) return null;
  return { id: row.id, mine: row.member_id === memberId, updatedAt: row.updated_at, form: parsed.form };
}

/** O que vai para a coluna definition: só os membros (o nome e quem vê ficam nas colunas próprias). */
function definitionOf(form) {
  return { version: 1, members: form.members };
}

/**
 * Os times que a pessoa pode usar: os dela e os da empresa, dos mais recentes para os mais antigos.
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @returns {Promise<SavedCustomRecipe[]>}
 */
export async function listCustomRecipes(session, memberId) {
  const { data, error } = await session.from(TABLE).select(COLUMNS).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => toSaved(row, memberId)).filter((saved) => saved !== null);
}

/**
 * Um time que a pessoa pode usar, ou null.
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @param {string} id
 * @returns {Promise<SavedCustomRecipe | null>}
 */
export async function loadCustomRecipe(session, memberId, id) {
  const { data, error } = await session.from(TABLE).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toSaved(data, memberId) : null;
}

/**
 * Salva um time novo da pessoa. Devolve o id, ou "limit" se ela já tem o máximo.
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @param {CustomRecipeForm} form
 * @returns {Promise<{ id: string } | "limit">}
 */
export async function createCustomRecipe(session, memberId, form) {
  const { count, error: countError } = await session
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_CUSTOM_RECIPES) return "limit";
  const { data, error } = await session
    .from(TABLE)
    .insert({ name: form.name, visibility: form.visibility, definition: definitionOf(form) })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

/**
 * Muda um time. Devolve false se a pessoa não pode mudá-lo (ou ele não existe).
 * @param {SupabaseClient} session
 * @param {string} id
 * @param {CustomRecipeForm} form
 * @returns {Promise<boolean>}
 */
export async function updateCustomRecipe(session, id, form) {
  const { data, error } = await session
    .from(TABLE)
    .update({ name: form.name, visibility: form.visibility, definition: definitionOf(form) })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Apaga um time. As execuções que já rodaram com ele continuam (guardam o time como estava). Devolve false se a
 * pessoa não pode apagá-lo.
 * @param {SupabaseClient} session
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteCustomRecipe(session, id) {
  const { data, error } = await session.from(TABLE).delete().eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
