// Monta o que cada IA recebe numa etapa: quem ela é (prompt de sistema)
// e o material de trabalho (o pedido e as respostas das etapas anteriores).

/**
 * Chave em que o motor guarda o veredito da revisão nas saídas. As etapas que recebem from:"review"
 * leem esta chave. Não é a saída de nenhuma etapa comum, por isso o nome com underscores.
 */
export const REVIEW_FEEDBACK_KEY = "__review_feedback__";

/**
 * Quem a IA é (o papel) + o que ela faz agora (a etapa).
 * @param {Role} role
 * @param {Step} step
 * @returns {string}
 */
export function buildSystemPrompt(role, step) {
  return `${role.systemPrompt}\n\n${step.instruction}`;
}

/**
 * Junta, na ordem da receita, o que a etapa recebe, cada parte com o seu nome.
 * As marcas <parte> separam bem as partes mesmo quando o conteúdo tem títulos ou código HTML.
 * @param {Step} step
 * @param {string} request
 * @param {ReadonlyMap<string, string>} outputs
 * @returns {string}
 */
export function buildStepInput(step, request, outputs) {
  return step.inputs
    .map((input) => `<parte nome="${input.label}">\n${contentOf(input, request, outputs)}\n</parte>`)
    .join("\n\n");
}

function contentOf(input, request, outputs) {
  if (input.from === "request") return request;
  // Na primeira rodada ainda não houve revisão: chega vazio.
  if (input.from === "review") return outputs.get(REVIEW_FEEDBACK_KEY) ?? "";
  const output = outputs.get(input.stepId);
  if (output === undefined) {
    throw new Error(`Falta a resposta da etapa "${input.stepId}", que deveria ter rodado antes.`);
  }
  return output;
}
