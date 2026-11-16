// A receita própria (F08) do jeito que o funcionário monta na tela: um nome, quem vê (só ele ou a empresa toda) e um
// time de 2 a 5 membros, cada um com um nome, uma IA e o que faz. Os membros trabalham um depois do outro: cada um
// recebe o pedido e o que o anterior fez, e o último entrega o resultado em Word.
// Só dados e funções puras: roda dos dois lados (a tela confere antes de mandar; o servidor confere de novo, porque pela
// internet pode chegar qualquer coisa). Mudou aqui? Mude também a cópia do outro lado (FrontEnd/src/lib/copies.test.js).

/** O id que a receita própria ganha na tela e na execução: "custom:<id no banco>". */
export const CUSTOM_RECIPE_PREFIX = "custom:";

export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 5;
export const MAX_RECIPE_NAME = 60;
export const MAX_MEMBER_NAME = 40;
export const MIN_INSTRUCTION = 10;
export const MAX_INSTRUCTION = 1500;
/** Quantas receitas próprias cada pessoa pode ter (as dela; as da empresa contam para quem criou). */
export const MAX_CUSTOM_RECIPES = 20;

/** @typedef {"private" | "company"} CustomVisibility */

/**
 * @typedef {{
 * name: string;
 * provider: ProviderId;
 * // O que este membro faz, nas palavras de quem montou o time.
 * instruction: string;
 * }} CustomMember
 */

/**
 * @typedef {{
 * name: string;
 * visibility: CustomVisibility;
 * members: CustomMember[];
 * }} CustomRecipeForm
 */

/** Modelos prontos de membro, para começar mais rápido. A pessoa muda o que quiser depois. */
export const MEMBER_TEMPLATES = [
  {
    name: "Pesquisador",
    provider: "claude",
    instruction:
      "Levante o que é preciso saber para fazer o trabalho: o contexto, os pontos principais e as dúvidas. Organize em tópicos curtos.",
  },
  {
    name: "Planejador",
    provider: "claude",
    instruction: "Monte o plano do trabalho: as partes, a ordem e o que cada parte precisa dizer. Não escreva o texto final.",
  },
  {
    name: "Redator",
    provider: "gpt",
    instruction: "Escreva o texto completo, claro e direto, seguindo o que o membro anterior preparou.",
  },
  {
    name: "Analista",
    provider: "claude",
    instruction:
      "Organize os números e as informações do pedido, faça as contas necessárias e aponte o que chama a atenção.",
  },
  {
    name: "Revisor",
    provider: "gemini",
    instruction:
      "Revise o trabalho: corrija erros, deixe mais claro e confira se atende ao pedido. Entregue a versão corrigida, completa.",
  },
  {
    name: "Tradutor",
    provider: "gpt",
    instruction: "Traduza o trabalho para o idioma pedido, mantendo o tom e o formato. Entregue só a tradução.",
  },
];

const PROVIDER_IDS = ["claude", "gpt", "gemini"];

/**
 * Confere uma receita própria que chegou (da tela ou do banco) e devolve ela limpa, ou a lista de problemas em português.
 * @param {unknown} value
 * @returns {{ ok: true; form: CustomRecipeForm } | { ok: false; problems: string[] }}
 */
export function parseCustomRecipe(value) {
  if (!isObject(value)) return { ok: false, problems: ["Não entendemos o time enviado."] };
  const problems = [];

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) problems.push("Dê um nome para o time.");
  else if (name.length > MAX_RECIPE_NAME) problems.push(`O nome do time passou de ${MAX_RECIPE_NAME} caracteres.`);

  const visibility = value.visibility === "company" ? "company" : "private";
  if (value.visibility !== undefined && value.visibility !== "private" && value.visibility !== "company") {
    problems.push("Escolha quem pode usar o time: só você ou a empresa toda.");
  }

  const rawMembers = Array.isArray(value.members) ? value.members : [];
  if (rawMembers.length < MIN_MEMBERS) problems.push(`O time precisa de pelo menos ${MIN_MEMBERS} membros.`);
  if (rawMembers.length > MAX_MEMBERS) problems.push(`O time pode ter no máximo ${MAX_MEMBERS} membros.`);

  const members = rawMembers.slice(0, MAX_MEMBERS).map((raw, index) => {
    const position = index + 1;
    const member = isObject(raw) ? raw : {};
    const memberName = typeof member.name === "string" ? member.name.trim() : "";
    const instruction = typeof member.instruction === "string" ? member.instruction.trim() : "";
    const provider = typeof member.provider === "string" ? member.provider : "";
    if (!memberName) problems.push(`Dê um nome para o membro ${position}.`);
    else if (memberName.length > MAX_MEMBER_NAME) {
      problems.push(`O nome do membro ${position} passou de ${MAX_MEMBER_NAME} caracteres.`);
    }
    if (!PROVIDER_IDS.includes(provider)) problems.push(`Escolha a IA do membro ${position}.`);
    if (instruction.length < MIN_INSTRUCTION) {
      problems.push(`Conte o que o membro ${position} faz (pelo menos ${MIN_INSTRUCTION} caracteres).`);
    } else if (instruction.length > MAX_INSTRUCTION) {
      problems.push(`O que o membro ${position} faz passou de ${MAX_INSTRUCTION} caracteres.`);
    }
    return { name: memberName, provider: /** @type {ProviderId} */ (provider), instruction };
  });

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, form: { name, visibility, members } };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
