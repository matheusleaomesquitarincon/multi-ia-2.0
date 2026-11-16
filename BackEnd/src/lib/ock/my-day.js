// O que a aba "Meu time" mostra (F08): o uso de cada dia, o que está pendente (receitas paradas ou rodando) e as
// receitas mais recentes. SÓ do servidor. Tudo pela sessão de quem está logado: o banco só devolve o que é da pessoa.

import { getRecipe } from "../recipes/catalog.js";
import { CUSTOM_RECIPE_LABEL, customRecipeDbId } from "../recipes/custom.js";

/** Quantos dias o gráfico mostra. */
export const MY_DAY_DAYS = 14;
/** Quantas receitas recentes a lista mostra. */
const RECENT_RUNS = 12;
/** Execuções que ainda pedem atenção: na fila, rodando ou pausadas esperando a pessoa. */
const PENDING_STATUSES = new Set(["queued", "running", "paused"]);

/**
 * @typedef {{ day: string; spentCents: number; tasks: number }} DayUsage
 */

/**
 * @typedef {{
 * id: string;
 * // O id da receita na tela (o de uma pronta, ou "custom:<id>" de um time), para abrir e acompanhar.
 * recipeId: string;
 * name: string;
 * status: string;
 * createdAt: string;
 * finishedAt: string | null;
 * }} RunSummary
 */

/**
 * @typedef {{
 * days: DayUsage[];
 * pending: RunSummary[];
 * recent: RunSummary[];
 * }} MyDay
 */

/**
 * @param {SupabaseClient} session
 * @returns {Promise<MyDay>}
 */
export async function loadMyDay(session) {
  const [daily, runs, teams] = await Promise.all([
    session.rpc("my_daily_spending", { p_days: MY_DAY_DAYS }),
    session
      .from("runs")
      .select("id, recipe_id, custom_recipe_id, status, created_at, finished_at")
      .order("created_at", { ascending: false })
      .limit(50),
    session.from("custom_recipes").select("id, name"),
  ]);
  if (daily.error) throw daily.error;
  if (runs.error) throw runs.error;
  if (teams.error) throw teams.error;

  const teamNames = new Map((teams.data ?? []).map((team) => [team.id, team.name]));
  const summaries = (runs.data ?? []).map((row) => toSummary(row, teamNames));
  return {
    days: (daily.data ?? []).map((row) => ({
      day: String(row.day),
      spentCents: Number(row.spent_cents),
      tasks: Number(row.tasks),
    })),
    pending: summaries.filter((run) => PENDING_STATUSES.has(run.status)),
    recent: summaries.filter((run) => !PENDING_STATUSES.has(run.status)).slice(0, RECENT_RUNS),
  };
}

/**
 * O nome de uma execução: o da receita pronta, ou o nome atual do time (para a própria pessoa, que o escreveu).
 * Se o time foi apagado, "Receita própria".
 */
function toSummary(row, teamNames) {
  const customId = customRecipeDbId(row.recipe_id);
  const name =
    customId === null
      ? (getRecipe(row.recipe_id)?.name ?? "Receita")
      : (teamNames.get(row.custom_recipe_id ?? customId) ?? CUSTOM_RECIPE_LABEL);
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name,
    status: row.status,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? null,
  };
}
