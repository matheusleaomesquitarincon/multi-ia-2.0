// A estimativa de custo de uma receita: o MÁXIMO que o time pode gastar (decisão do Luis de 25/10/2026). Funciona como
// a pré-autorização do cartão num hotel: a plataforma reserva o máximo e cobra só o que o time usou.
// O máximo de uma etapa soma o maior texto que ela pode receber (o pedido mais longo e as respostas mais longas das
// etapas anteriores) e o maior texto que a IA pode escrever, contando o "pensamento" (lib/providers/limits.js).
//
// O servidor calcula o máximo de cada etapa com cada IA (stepCosts). A soma para um time (estimate-sum.js) roda também
// no navegador, que recebe só esses números, nunca as instruções das IAs. Este arquivo não importa o catálogo de
// receitas: quem chama entrega a receita.

import { buildSystemPrompt } from "../engine/input.js";

export { estimateCents } from "./estimate-sum.js";

import { MAX_REQUEST_CHARS } from "../engine/validate.js";
import { costInCents } from "../ock/pricing.js";
import { PROVIDERS } from "../providers/catalog.js";
import { ESTIMATE_CHARS_PER_TOKEN, outputTokenCap } from "../providers/limits.js";
import { CHARS_PER_TOKEN } from "../providers/mock.js";
import { DEFAULT_TIER } from "../providers/types.js";
import { stageSteps } from "../recipes/types.js";

/** O custo máximo de uma etapa com cada IA e quantas vezes ela ainda pode rodar. */
/**
 * @typedef {{
 * stepId: string;
 * roleId: string;
 * // IA fixa da etapa, quando a receita manda (ex.: a revisão). Sem valor, vale a IA do papel no time.
 * provider?: ProviderId;
 * // Quantas vezes a etapa ainda pode rodar (a revisão pode mandar refazer uma fase).
 * runs: number;
 * // O máximo de UMA vez, em centavos, com cada IA.
 * cents: Record<ProviderId, number>;
 * }} StepCost
 */

/** O começo da execução: a 1ª fase, rodada 1. */
const START = { stageIndex: 0, round: 1 };

/**
 * O custo máximo de cada etapa que ainda pode rodar a partir de `from` (o começo, se não vier). Para a parte que falta
 * de uma execução no meio, passe o cursor dela.
 * @param {Recipe} recipe
 * @param {RunCursor} [from]
 * @returns {StepCost[]}
 */
export function stepCosts(recipe, from = START) {
  const runs = countRuns(recipe, from);
  const costs = [];
  for (const step of recipe.stages.flatMap(stageSteps)) {
    const times = runs.get(step.id) ?? 0;
    if (times === 0) continue;
    const inputTokens = maxInputTokens(recipe, step);
    const cents = Object.fromEntries(
      PROVIDERS.map(({ id }) => [
        id,
        costInCents(id, DEFAULT_TIER, {
          inputTokens,
          outputTokens: outputTokenCap(id, step.maxOutputTokens, step.effort ?? "medium"),
        }),
      ]),
    );
    costs.push({ stepId: step.id, roleId: step.roleId, provider: step.provider, runs: times, cents });
  }
  return costs;
}

/**
 * Quantas vezes cada etapa ainda pode rodar a partir de `from`. Uma revisão roda uma vez por rodada que falta e, da 2ª
 * rodada em diante, a fase que ela manda refazer roda antes dela.
 */
function countRuns(recipe, from) {
  const runs = new Map();
  const add = (stage, times) => {
    if (times <= 0) return;
    for (const step of stageSteps(stage)) runs.set(step.id, (runs.get(step.id) ?? 0) + times);
  };

  recipe.stages.forEach((stage, index) => {
    if (index < from.stageIndex) return;
    if (stage.kind !== "review") {
      add(stage, 1);
      return;
    }
    const firstRound = index === from.stageIndex ? from.round : 1;
    add(stage, stage.maxRounds - firstRound + 1);
    const rework = recipe.stages.find((candidate) => candidate.id === stage.reworkStageId);
    if (rework) add(rework, stage.maxRounds - Math.max(firstRound, 2) + 1);
  });
  return runs;
}

/**
 * O maior texto que a etapa pode receber, em tokens: as instruções, o pedido mais longo, a resposta mais longa de cada
 * etapa anterior e as marcas que separam as partes, contados com a folga do português (ESTIMATE_CHARS_PER_TOKEN). As
 * respostas anteriores entram pelo tamanho em caracteres (4 por token), o que dá folga também para a IA seguinte, que
 * pode contar os tokens de outro jeito.
 */
function maxInputTokens(recipe, step) {
  const role = recipe.roles.find((candidate) => candidate.id === step.roleId);
  const systemChars = role ? buildSystemPrompt(role, step).length : 0;
  // As partes vão juntas, separadas por uma linha em branco (lib/engine/input.js).
  const separators = Math.max(0, step.inputs.length - 1) * "\n\n".length;
  const inputChars = step.inputs.reduce(
    (total, input) =>
      total + `<parte nome="${input.label}">\n`.length + maxContentChars(recipe, input) + "\n</parte>".length,
    separators,
  );
  return Math.ceil((systemChars + inputChars) / ESTIMATE_CHARS_PER_TOKEN);
}

/** O maior conteúdo de uma parte da entrada, em caracteres. */
function maxContentChars(recipe, input) {
  switch (input.from) {
    case "request":
      return MAX_REQUEST_CHARS;
    case "step": {
      const source = recipe.stages.flatMap(stageSteps).find((candidate) => candidate.id === input.stepId);
      return source ? maxOutputChars(source) : 0;
    }
    case "review":
      // O que a revisão pediu: a maior resposta entre as etapas de revisão da receita.
      return Math.max(
        0,
        ...recipe.stages.flatMap((stage) => (stage.kind === "review" ? [maxOutputChars(stage.step)] : [])),
      );
  }
}

/** A resposta mais longa que uma etapa pode escrever, com a IA que mais escreve. */
function maxOutputChars(step) {
  const tokens = Math.max(
    ...PROVIDERS.map(({ id }) => outputTokenCap(id, step.maxOutputTokens, step.effort ?? "medium")),
  );
  return tokens * CHARS_PER_TOKEN;
}
