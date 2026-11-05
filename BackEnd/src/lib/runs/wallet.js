// A carteira da empresa vista por uma execução de receita (reservar a estimativa, cobrar cada etapa concluída e fechar
// a reserva) e por uma mensagem do chat (reservar o máximo da resposta, cobrar o consumo real e fechar).
// SÓ do servidor. O dinheiro só se mexe pelas funções da carteira no banco (wallet_reserve, wallet_charge e
// wallet_close_hold, ver supabase/migrations/..._wallet.sql), que travam a carteira enquanto conferem e lançam (F24).
// Cada reserva guarda o id da execução (run_id) ou da mensagem (task_id): é assim que cada uma acha a sua reserva.

import { formatBRL } from "../ock/pricing.js";

import { supabaseAdmin } from "./supabase-server.js";

const HOLDS = "wallet_holds";
const ENTRIES = "wallet_entries";

/** Por que o banco recusou a reserva. */
/** @typedef {"insufficient_balance" | "monthly_budget_exceeded" | "member_inactive"} WalletRefusalReason */

const REFUSAL_REASONS = ["insufficient_balance", "monthly_budget_exceeded", "member_inactive"];

/** O banco não deixou reservar: falta saldo, passaria do teto do mês ou a pessoa foi desativada. */
export class WalletRefusedError extends Error {
  constructor(reason) {
    super(`A carteira recusou a reserva: ${reason}.`);
    this.reason = reason;
    this.name = "WalletRefusedError";
  }
}

/**
 * O que a tela diz quando a reserva é recusada, em português, com o que fazer. `amountCents` é o que se tentou
 * reservar: o máximo que o time pode gastar (ao começar) ou o que falta (ao continuar depois de uma pausa).
 * @param {WalletRefusalReason} reason
 * @param {boolean} isOwner
 * @param {number} amountCents
 * @returns {string}
 */
export function walletRefusalMessage(reason, isOwner, amountCents) {
  const amount = formatBRL(amountCents);
  switch (reason) {
    case "insufficient_balance":
      return (
        `A empresa não tem saldo para reservar ${amount}, o máximo que o time pode gastar. ` +
        (isOwner ? "Para colocar crédito, fale com a nossa equipe." : "Peça ao dono da empresa para colocar crédito.")
      );
    case "monthly_budget_exceeded":
      return (
        `Reservar ${amount}, o máximo que o time pode gastar, passaria do seu teto do mês. ` +
        // O painel do dono muda o teto dos funcionários; o do próprio dono, por enquanto, só a nossa equipe.
        (isOwner
          ? "Para mudar o seu teto, fale com a nossa equipe."
          : "Peça ao dono da empresa para aumentar o seu teto.")
      );
    case "member_inactive":
      return "A sua conta foi desativada pela empresa. Fale com o dono da empresa.";
  }
}

/**
 * O que o chat diz quando a reserva de uma mensagem é recusada. `amountCents` é o máximo que a resposta pode custar;
 * vazio na primeira conferência, antes de o Chefe decidir, quando ainda não se sabe esse máximo.
 * @param {WalletRefusalReason} reason
 * @param {boolean} isOwner
 * @param {number | null} amountCents
 * @returns {string}
 */
export function taskRefusalMessage(reason, isOwner, amountCents) {
  const amount = amountCents === null ? null : formatBRL(amountCents);
  switch (reason) {
    case "insufficient_balance":
      return (
        (amount
          ? `A empresa não tem saldo para reservar ${amount}, o máximo que esta resposta pode custar. `
          : "A empresa está sem saldo. ") +
        (isOwner ? "Para colocar crédito, fale com a nossa equipe." : "Peça ao dono da empresa para colocar crédito.") +
        " Nada foi cobrado."
      );
    case "monthly_budget_exceeded":
      return (
        (amount
          ? `Reservar ${amount}, o máximo que esta resposta pode custar, passaria do seu teto do mês. `
          : "Você chegou ao seu teto do mês. ") +
        (isOwner
          ? "Para mudar o seu teto, fale com a nossa equipe."
          : "Peça ao dono da empresa para aumentar o seu teto.") +
        " Nada foi cobrado."
      );
    case "member_inactive":
      return walletRefusalMessage(reason, isOwner, 0);
  }
}

/** Uma reserva aberta de uma execução. */
/**
 * @typedef {{
 * id: string;
 * amountCents: number;
 * chargedCents: number;
 * expiresAt: string;
 * }} RunHold
 */

/**
 * O que ainda sobra da reserva (negativo quando o gasto já passou dela).
 * @param {RunHold} hold
 * @returns {number}
 */
export function holdRemainingCents(hold) {
  return hold.amountCents - hold.chargedCents;
}

/**
 * Reserva `amountCents` do saldo da empresa para a execução. Devolve o id da reserva.
 * Recusa com WalletRefusedError (sem saldo, passaria do teto do mês, pessoa desativada).
 * @param {string} memberId
 * @param {string} runId
 * @param {number} amountCents
 * @returns {Promise<string>}
 */
export async function reserveForRun(memberId, runId, amountCents) {
  return reserve({ p_member_id: memberId, p_amount_cents: amountCents, p_run_id: runId });
}

/**
 * Por quanto tempo a reserva de uma mensagem do chat segura o saldo, se o servidor cair no meio. Folga sobre os 5
 * minutos que uma resposta pode levar (maxDuration da rota do chat).
 */
const TASK_HOLD_TTL = "15 minutes";

/**
 * Reserva `amountCents` do saldo da empresa para uma mensagem do chat. Devolve o id da reserva.
 * Recusa com WalletRefusedError (sem saldo, passaria do teto do mês, pessoa desativada).
 * @param {string} memberId
 * @param {string} taskId
 * @param {number} amountCents
 * @returns {Promise<string>}
 */
export async function reserveForTask(memberId, taskId, amountCents) {
  return reserve({ p_member_id: memberId, p_amount_cents: amountCents, p_task_id: taskId, p_ttl: TASK_HOLD_TTL });
}

async function reserve(params) {
  const { data, error } = await supabaseAdmin().rpc("wallet_reserve", params);
  if (error) {
    const reason = REFUSAL_REASONS.find((candidate) => error.message === candidate);
    if (reason) throw new WalletRefusedError(reason);
    throw error;
  }
  return data;
}

/** Uma linha de gasto no extrato: o custo de uma etapa concluída. */
/**
 * @typedef {{
 * amountCents: number;
 * // Escrita pelo servidor, nunca com o pedido do funcionário: "Criar um site · Front-end".
 * description: string;
 * provider: ProviderId;
 * }} StepCharge
 */

/**
 * Cobra uma etapa na reserva. Devolve quanto ainda sobra dela (negativo: o gasto passou da estimativa), ou null se a
 * reserva já foi fechada (a pessoa cancelou enquanto a fase terminava): aí nada é cobrado.
 * @param {string} holdId
 * @param {string} runId
 * @param {StepCharge} charge
 * @returns {Promise<number | null>}
 */
export async function chargeStep(holdId, runId, charge) {
  const { data, error } = await supabaseAdmin().rpc("wallet_charge", {
    p_hold_id: holdId,
    p_amount_cents: charge.amountCents,
    p_description: charge.description,
    p_provider: charge.provider,
    p_run_id: runId,
  });
  if (error) {
    if (error.message === "hold_closed") return null;
    throw error;
  }
  return Number(data);
}

/**
 * A reserva aberta mais recente da execução, ou null se não houver (nunca reservou, ou já fechou).
 * @param {string} runId
 * @returns {Promise<RunHold | null>}
 */
export async function findOpenRunHold(runId) {
  const { data, error } = await supabaseAdmin()
    .from(HOLDS)
    .select("id, amount_cents, charged_cents, expires_at")
    .eq("run_id", runId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data;
  return {
    id: row.id,
    amountCents: Number(row.amount_cents),
    chargedCents: Number(row.charged_cents),
    expiresAt: row.expires_at,
  };
}

/**
 * Fecha todas as reservas abertas da execução: o que não foi cobrado volta a ficar disponível.
 * @param {string} runId
 * @returns {Promise<void>}
 */
export async function closeRunHolds(runId) {
  const db = supabaseAdmin();
  const { data, error } = await db.from(HOLDS).select("id").eq("run_id", runId).eq("status", "open");
  if (error) throw error;
  for (const { id } of data ?? []) {
    const { error: closeError } = await db.rpc("wallet_close_hold", { p_hold_id: id });
    if (closeError) throw closeError;
  }
}

/**
 * Quantas etapas da execução já viraram linha de gasto. Cada etapa concluída vira exatamente uma linha (a cobrança
 * mínima é de 1 centavo), então é por este número que se sabe o que ainda falta cobrar sem cobrar nada duas vezes.
 * @param {string} runId
 * @returns {Promise<number>}
 */
export async function countRunCharges(runId) {
  const { count, error } = await supabaseAdmin()
    .from(ENTRIES)
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("kind", "charge");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Quanto a execução custou até agora, em centavos, lido com a sessão de quem está logado (só os gastos dela).
 * @param {SupabaseClient} session
 * @param {string} runId
 * @returns {Promise<number>}
 */
export async function sumOwnRunCharges(session, runId) {
  const { data, error } = await session.from(ENTRIES).select("amount_cents").eq("run_id", runId).eq("kind", "charge");
  if (error) throw error;
  // Os gastos entram negativos no extrato.
  return (data ?? []).reduce((total, row) => total - Number(row.amount_cents), 0);
}

/**
 * Cobra uma mensagem do chat pronta na reserva dela: uma linha de gasto só, com a IA que respondeu. Devolve quanto
 * ainda sobra da reserva, ou null se ela já foi fechada (aí nada é cobrado).
 * @param {string} holdId
 * @param {string} taskId
 * @param {StepCharge} charge
 * @returns {Promise<number | null>}
 */
export async function chargeTask(holdId, taskId, charge) {
  const { data, error } = await supabaseAdmin().rpc("wallet_charge", {
    p_hold_id: holdId,
    p_amount_cents: charge.amountCents,
    p_description: charge.description,
    p_provider: charge.provider,
    p_task_id: taskId,
  });
  if (error) {
    if (error.message === "hold_closed") return null;
    throw error;
  }
  return Number(data);
}

/**
 * Reserva `amountCents` para um ditado (a voz do chat). Não fica ligada a nenhuma execução nem mensagem: a linha de
 * gasto entra no total do mês, mas não conta como tarefa rápida nem receita.
 * Recusa com WalletRefusedError (sem saldo, passaria do teto do mês, pessoa desativada).
 * @param {string} memberId
 * @param {number} amountCents
 * @returns {Promise<string>}
 */
export async function reserveForVoice(memberId, amountCents) {
  return reserve({ p_member_id: memberId, p_amount_cents: amountCents, p_ttl: TASK_HOLD_TTL });
}

/**
 * Cobra um ditado na reserva dele. Devolve quanto sobra, ou null se a reserva já foi fechada (nada é cobrado).
 * @param {string} holdId
 * @param {StepCharge} charge
 * @returns {Promise<number | null>}
 */
export async function chargeVoice(holdId, charge) {
  const { data, error } = await supabaseAdmin().rpc("wallet_charge", {
    p_hold_id: holdId,
    p_amount_cents: charge.amountCents,
    p_description: charge.description,
    p_provider: charge.provider,
  });
  if (error) {
    if (error.message === "hold_closed") return null;
    throw error;
  }
  return Number(data);
}

/**
 * Fecha uma reserva: o que não foi cobrado volta a ficar disponível. Fechar de novo não faz nada.
 * @param {string} holdId
 * @returns {Promise<void>}
 */
export async function closeHold(holdId) {
  const { error } = await supabaseAdmin().rpc("wallet_close_hold", { p_hold_id: holdId });
  if (error) throw error;
}
