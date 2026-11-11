// Lista de receitas. As prontas ficam em RECIPES; as do MVP que ainda não foram feitas aparecem como "Em breve", só
// com nome, descrição e time (hoje, nenhuma: as 4 do MVP estão prontas).

import { clientReportRecipe } from "./client-report.js";
import { commercialProposalRecipe } from "./commercial-proposal.js";
import { createSiteRecipe } from "./create-site.js";
import { socialPostsRecipe } from "./social-posts.js";

export const RECIPES = [createSiteRecipe, commercialProposalRecipe, socialPostsRecipe, clientReportRecipe];

/** Receitas anunciadas como "Em breve". */
const COMING_SOON = [];

/**
 * @param {string} id
 * @returns {Recipe | undefined}
 */
export function getRecipe(id) {
  return RECIPES.find((recipe) => recipe.id === id);
}

/**
 * Cartões da página inicial: primeiro as receitas prontas, depois as que estão "Em breve".
 * @returns {RecipeSummary[]}
 */
export function listRecipeSummaries() {
  return [...RECIPES.map(summarize), ...COMING_SOON];
}

function summarize(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    available: true,
    team: recipe.roles.map((role) => ({ roleName: role.name, provider: role.suggestedProvider })),
  };
}
