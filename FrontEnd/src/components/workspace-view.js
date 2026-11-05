// O que está aberto no espaço de trabalho: a aba e, na aba Receitas, a receita escolhida. Fica no endereço
// (/trabalho?aba=receitas&receita=create-site): recarregar a página volta para o mesmo lugar, e o endereço antigo de
// uma receita (/recipes/create-site) leva direto para ela. Valor desconhecido no endereço vira o padrão, sem erro.

export const WORKSPACE_TABS = [
  { id: "chat", label: "Chat", param: "chat" },
  { id: "recipes", label: "Receitas", param: "receitas" },
  { id: "deliveries", label: "Entregas", param: "entregas" },
  { id: "spending", label: "Meus gastos", param: "gastos" },
];

/** @typedef {(typeof WORKSPACE_TABS)[number]["id"]} WorkspaceTab */

/**
 * @typedef {{
 * tab: WorkspaceTab;
 * // A receita aberta na aba Receitas; null mostra os cartões.
 * recipeId: string | null;
 * }} WorkspaceView
 */

/** @typedef {string | string[] | undefined} SearchValue */

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lê a aba e a receita do endereço. `recipeIds` são as receitas prontas: outra qualquer é ignorada. Com uma receita e
 * sem aba, abre a aba Receitas.
 * @param {{ aba?: SearchValue; receita?: SearchValue }} params
 * @param {readonly string[]} recipeIds
 * @returns {WorkspaceView}
 */
export function readWorkspaceView(params, recipeIds) {
  const receita = first(params.receita);
  const recipeId = receita !== undefined && recipeIds.includes(receita) ? receita : null;
  const aba = first(params.aba);
  const tab = WORKSPACE_TABS.find((item) => item.param === aba)?.id ?? (recipeId ? "recipes" : "chat");
  return { tab, recipeId };
}

/**
 * O endereço (só a parte depois do "?") com a aba e a receita de `view`, mantendo o resto. O Chat sem receita aberta é
 * o padrão e não aparece; com uma receita aberta, aparece (sem aba, a receita abriria a aba Receitas). Fechar a receita
 * tira também o ?run= da execução que ela acompanhava.
 * @param {string} current
 * @param {WorkspaceView} view
 * @returns {string}
 */
export function workspaceSearch(current, view) {
  const params = new URLSearchParams(current);
  const tab = WORKSPACE_TABS.find((item) => item.id === view.tab);
  if (!tab || (tab.id === "chat" && !view.recipeId)) params.delete("aba");
  else params.set("aba", tab.param);
  if (view.recipeId) {
    params.set("receita", view.recipeId);
  } else {
    params.delete("receita");
    params.delete("run");
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

/**
 * O endereço de uma receita dentro do espaço de trabalho, com a execução que ela acompanha, se houver.
 * @param {string} recipeId
 * @param {string} [runId]
 * @returns {string}
 */
export function recipeHref(recipeId, runId) {
  const params = new URLSearchParams({ aba: "receitas", receita: recipeId });
  if (runId) params.set("run", runId);
  return `/trabalho?${params.toString()}`;
}
