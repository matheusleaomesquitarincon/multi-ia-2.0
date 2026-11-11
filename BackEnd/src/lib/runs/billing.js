// A conta de uma execução: quanto cobrar de cada etapa concluída e o que registrar de cada chamada às IAs. SÓ do
// servidor. Regras (AGENTS.md, seção 5): cada etapa concluída é cobrada pelo consumo real; etapa que falhou e etapa
// interrompida pelo cancelamento não são cobradas, mas o custo delas fica no registro interno (F26).

import { costInCents, costInUsd, USD_TO_BRL } from "../ock/pricing.js";
import { DEFAULT_TIER } from "../providers/types.js";
import { stageSteps } from "../recipes/types.js";

import { chargeStep, countRunCharges } from "./wallet.js";

/** No registro interno, o modelo de uma chamada que falhou sem o conector dizer qual era. */
export const UNKNOWN_MODEL = "desconhecido";

/**
 * Quanto cobrar por uma etapa concluída, em centavos: o consumo real, com no mínimo 1 centavo. O mínimo garante que
 * cada etapa vire exatamente uma linha de gasto, que é como se sabe o que já foi cobrado (countRunCharges).
 * @param {StepResult} result
 * @returns {number}
 */
export function stepChargeCents(result) {
  return Math.max(1, costInCents(result.provider, DEFAULT_TIER, result.usage));
}

/**
 * A descrição da linha de gasto no extrato: a receita e a etapa ("Criar um site · Front-end"), nunca o pedido.
 * @param {Recipe} recipe
 * @param {string} stepId
 * @returns {string}
 */
export function chargeDescription(recipe, stepId) {
  const step = recipe.stages.flatMap(stageSteps).find((candidate) => candidate.id === stepId);
  return `${recipe.name} · ${step?.name ?? stepId}`.slice(0, 200);
}

/**
 * Cobra na reserva, na ordem em que terminaram, as etapas concluídas (`results`) que ainda não viraram linha de gasto.
 * Assim, se o servidor cair entre gravar uma fase e cobrar, a próxima chamada cobra o que faltou. Cada etapa vai com a
 * posição dela, e o banco cobra cada posição uma vez só (F43): se outro servidor cobrou antes, ela é pulada. Devolve as
 * etapas cobradas agora.
 * @param {string} runId
 * @param {Recipe} recipe
 * @param {readonly StepResult[]} results
 * @param {string} holdId
 * @returns {Promise<StepResult[]>}
 */
export async function chargeCompletedSteps(runId, recipe, results, holdId) {
  const charged = [];
  const alreadyCharged = await countRunCharges(runId);
  for (let stepSeq = alreadyCharged; stepSeq < results.length; stepSeq++) {
    const result = results[stepSeq];
    const remaining = await chargeStep(holdId, runId, {
      amountCents: stepChargeCents(result),
      description: chargeDescription(recipe, result.stepId),
      provider: result.provider,
      stepSeq,
    });
    if (remaining !== null) charged.push(result);
  }
  return charged;
}

/**
 * As linhas da tabela interna ai_calls para as chamadas às IAs de um segmento. Só a chamada que deu certo de uma etapa
 * cobrada agora (`chargedStepIds`) fica marcada como cobrada.
 * @param {Pick<RunRow, "id" | "company_id" | "member_id">} run
 * @param {readonly AiCallReport[]} calls
 * @param {ReadonlySet<string>} chargedStepIds
 * @returns {AiCallRow[]}
 */
export function aiCallRows(run, calls, chargedStepIds) {
  return calls.map((call) => ({
    company_id: run.company_id,
    member_id: run.member_id,
    run_id: run.id,
    step_id: call.stepId,
    attempt: call.attempt,
    provider: call.provider,
    model: call.model ?? UNKNOWN_MODEL,
    tier: call.tier,
    input_tokens: call.usage.inputTokens,
    output_tokens: call.usage.outputTokens,
    // A coluna guarda 6 casas depois da vírgula.
    cost_usd: Number(costInUsd(call.provider, call.tier, call.usage).toFixed(6)),
    usd_brl: USD_TO_BRL,
    charged: call.ok && chargedStepIds.has(call.stepId),
    status: call.ok ? "ok" : "error",
    error_message: call.errorMessage?.slice(0, 2000) ?? null,
    duration_ms: Math.max(0, Math.round(call.durationMs)),
  }));
}
