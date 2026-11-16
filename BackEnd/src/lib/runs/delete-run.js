// Apagar uma receita rodada (F64, LGPD: a pessoa pode apagar o que fez). SÓ do servidor. Pela sessão de quem está
// logado: o banco só deixa apagar as próprias execuções, e só as que pararam (runs_delete_own).
//
// O que some: o pedido, o time, as etapas, o resultado e a narração ao vivo (run_events, em cascata). O que fica: a
// entrega (continua na aba Entregas, onde a pessoa apaga se quiser) e as linhas de gasto do extrato, que nunca se apagam.

import { closeRunHolds } from "./wallet.js";
import { loadOwnRun } from "./store.js";

/** Rodando ou na fila: precisa cancelar antes (senão o servidor que roda gravaria numa execução que sumiu). */
const BUSY = new Set(["queued", "running"]);

/** @typedef {"deleted" | "not-found" | "busy"} DeleteRunResult */

/**
 * @param {SupabaseClient} session
 * @param {string} runId
 * @returns {Promise<DeleteRunResult>}
 */
export async function deleteOwnRun(session, runId) {
  const run = await loadOwnRun(session, runId);
  if (!run) return "not-found";
  if (BUSY.has(run.status)) return "busy";
  // Uma execução pausada ainda segura dinheiro reservado: ele volta ao saldo antes de a execução sumir.
  if (run.status === "paused") await closeRunHolds(runId);
  const { data, error } = await session.from("runs").delete().eq("id", runId).select("id");
  if (error) throw error;
  return (data ?? []).length > 0 ? "deleted" : "not-found";
}
