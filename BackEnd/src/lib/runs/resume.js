// Retoma uma execução cuja corrente de etapas parou no meio. A corrente para quando uma chamada interna se perde
// ou quando o servidor cai (no computador, salvar um arquivo reinicia o `npm run dev`). Quem percebe é a tela: cada
// busca de novidades confere se a execução está parada e, se estiver, dispara a continuação de novo. Disparar a
// mais não faz mal: só um servidor consegue reivindicar a execução (claimRun). SÓ do servidor.

import { loadRun } from "./store.js";
import { triggerContinue } from "./trigger.js";

/** Na fila há mais do que isso sem ninguém pegar: a chamada que levaria a execução adiante se perdeu. */
export const QUEUED_GRACE_MS = 10 * 1000;

/**
 * Se a execução está parada: na fila há tempo demais ou "rodando" com a reserva de quem rodava já vencida.
 * @param {Pick<RunRow, "status" | "lease_until" | "updated_at">} run
 * @returns {boolean}
 */
export function needsResume(run, now = Date.now()) {
  const leaseExpired = run.lease_until === null || Date.parse(run.lease_until) < now;
  if (run.status === "running") return leaseExpired;
  if (run.status === "queued") return leaseExpired && Date.parse(run.updated_at) < now - QUEUED_GRACE_MS;
  return false;
}

/**
 * Confere a execução pelo servidor e, se ela estiver parada, dispara a continuação.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function resumeIfStalled(id) {
  const run = await loadRun(id);
  if (run && needsResume(run)) {
    console.warn(`[runs] A execução ${id} estava parada (${run.status}); disparando a continuação de novo.`);
    triggerContinue(id);
  }
}
