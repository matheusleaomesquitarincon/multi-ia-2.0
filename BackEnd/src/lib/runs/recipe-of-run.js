// A receita de uma execução. Receita pronta: a do catálogo, pelo id. Receita própria ("custom:<id>", F08): a que ficou
// guardada na própria execução ao começar (runs.custom_recipe), e não a do time salvo hoje, que pode ter mudado ou
// sumido. SÓ do servidor: a coluna do time guardado não é lida pela sessão.

import { getRecipe } from "../recipes/catalog.js";
import { buildCustomRecipe, customRecipeDbId } from "../recipes/custom.js";
import { parseCustomRecipe } from "../recipes/custom-form.js";

import { supabaseAdmin } from "./supabase-server.js";

/**
 * @param {{ id: string; recipe_id: string; custom_recipe?: unknown }} run
 *   `custom_recipe` quando a linha já veio inteira do banco; sem ele, é buscado pela chave-mestra (só depois de quem
 *   chama ter conferido, pela sessão, que a execução é da pessoa).
 * @returns {Promise<Recipe | undefined>}
 */
export async function recipeOfRun(run) {
  if (customRecipeDbId(run.recipe_id) === null) return getRecipe(run.recipe_id);

  let snapshot = run.custom_recipe;
  if (snapshot === undefined) {
    const { data, error } = await supabaseAdmin().from("runs").select("custom_recipe").eq("id", run.id).maybeSingle();
    if (error) throw error;
    snapshot = data?.custom_recipe;
  }
  return customRecipeFromSnapshot(snapshot);
}

/**
 * @param {unknown} snapshot
 * @returns {Recipe | undefined}
 */
export function customRecipeFromSnapshot(snapshot) {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const { id, form } = /** @type {{ id?: unknown; form?: unknown }} */ (snapshot);
  if (typeof id !== "string") return undefined;
  const parsed = parseCustomRecipe(form);
  return parsed.ok ? buildCustomRecipe({ id, form: parsed.form }) : undefined;
}
