// O que a tela de uma receita recebe do servidor: o nome, o exemplo de pedido, o título do resultado, os papéis (nome, frase e IA sugerida) e
// as fases com as etapas (nome e frases dos cartões). Nunca as instruções das IAs, os limites nem as respostas de
// exemplo: isso fica no servidor.

import { stageSteps } from "./types.js";

/** @typedef {Pick<Role, "id" | "name" | "description" | "suggestedProvider">} ScreenRole */

/**
 * @typedef {Pick<Step, "id" | "roleId" | "name" | "summary" | "doneSummary" | "format"> & {
 * stageId: string;
 * }} ScreenStep
 */

/**
 * @typedef {{
 * id: string;
 * kind: StageKind;
 * steps: ScreenStep[];
 * }} ScreenStage
 */

/**
 * @typedef {{
 * id: string;
 * name: string;
 * requestPlaceholder: string;
 * resultTitle: string;
 * roles: ScreenRole[];
 * stages: ScreenStage[];
 * }} RecipeScreen
 */

/**
 * @param {Recipe} recipe
 * @returns {RecipeScreen}
 */
export function recipeScreen(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    requestPlaceholder: recipe.requestPlaceholder,
    resultTitle: recipe.resultTitle,
    roles: recipe.roles.map(({ id, name, description, suggestedProvider }) => ({
      id,
      name,
      description,
      suggestedProvider,
    })),
    stages: recipe.stages.map((stage) => ({
      id: stage.id,
      kind: stage.kind,
      steps: stageSteps(stage).map(({ id, roleId, name, summary, doneSummary, format }) => ({
        id,
        stageId: stage.id,
        roleId,
        name,
        summary,
        doneSummary,
        format,
      })),
    })),
  };
}
