// Confere o pedido de execução que chega pela internet. De fora pode vir qualquer coisa
// (alguém pode adulterar o que o navegador manda), então nada passa sem conferir tipo e tamanho.
// Só o servidor usa este arquivo: ele lê as receitas completas, com as instruções das IAs.

import { findRunProblems } from "../engine/validate.js";

import { getRecipe } from "../recipes/catalog.js";

/** O que o navegador manda para começar uma execução. */
/**
 * @typedef {{
 * recipeId: string;
 * request: string;
 * // IA escolhida para cada papel (id do papel → IA).
 * team?: Record<string, ProviderId>;
 * // Quem abriu a página, para conferir que o login do navegador não mudou (F34).
 * pageMemberId: string;
 * }} RunRequestBody
 */

/** O que o servidor responde quando recusa o pedido. */
/**
 * @typedef {{
 * problems: string[];
 * }} RunRefusalBody
 */

/** @typedef {{ ok: true; input: RunInput } | { ok: false; problems: string[] }} ParsedRunRequest */

/**
 * Transforma o que chegou num pedido pronto para o motor ou na lista de problemas, em português.
 * @param {unknown} body
 * @returns {ParsedRunRequest}
 */
export function parseRunRequest(body) {
  if (!isPlainObject(body)) return refuse("Não entendemos o pedido enviado.");

  // Receita "Em breve" também não existe aqui: só as prontas rodam.
  const recipe = typeof body.recipeId === "string" ? getRecipe(body.recipeId) : undefined;
  if (!recipe) return refuse("Receita não encontrada.");
  if (typeof body.request !== "string") return refuse("Escreva o que você quer que o time faça.");
  if (body.team !== undefined && !isPlainObject(body.team)) {
    return refuse("O time enviado não é válido.");
  }

  // Cada papel e cada IA do time são conferidos em findRunProblems, junto com o tamanho do pedido.
  const input = { recipe, request: body.request, team: body.team };
  const problems = findRunProblems(input);
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, input };
}

function refuse(problem) {
  return { ok: false, problems: [problem] };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Se o id de execução que veio no endereço tem o formato de um id do banco. Outro formato nem chega ao banco.
 * @param {string} value
 * @returns {boolean}
 */
export function isRunId(value) {
  return UUID_PATTERN.test(value);
}
