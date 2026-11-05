// GET /api/runs/[id]: o resumo da execução que a tela precisa para montar e retomar o acompanhamento.
// Lido com a sessão de quem está logado: só a própria pessoa vê a execução dela (execução de outra pessoa é
// "não encontrada"), e só o que ela pode ver: o pedido, status, plano das fases, resultado final, tempo, a estimativa
// reservada ao começar e quanto já foi cobrado (as linhas de gasto dela no extrato).

import { signedInSession } from "../../../../lib/auth/session.js";
import { isRunId } from "../../../../lib/runs/parse-request.js";
import { loadOwnRun } from "../../../../lib/runs/store.js";
import { sumOwnRunCharges } from "../../../../lib/runs/wallet.js";

/**
 * @param {Request} _request
 * @param {RouteContext<"/api/runs/[id]">} context
 * @returns {Promise<Response>}
 */
export async function GET(_request, context) {
  const { id } = await context.params;
  const session = await signedInSession();
  if (!session) return problem(401, "Entre de novo para ver esta execução.");
  if (!isRunId(id)) return problem(404, "Execução não encontrada.");

  try {
    const run = await loadOwnRun(session, id);
    if (!run) return problem(404, "Execução não encontrada.");
    const chargedCents = await sumOwnRunCharges(session, id);
    return Response.json(
      {
        request: run.request,
        status: run.status,
        plan: run.plan,
        result: run.result,
        durationMs: run.duration_ms,
        estimateCents: run.estimate_cents,
        chargedCents,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`[api/runs] Falha ao carregar a execução ${id}:`, error);
    return problem(500, "Algo deu errado do nosso lado.");
  }
}

function problem(status, message) {
  return Response.json({ problems: [message] }, { status, headers: { "Cache-Control": "no-store" } });
}
