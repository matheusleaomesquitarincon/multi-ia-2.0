// GET /api/runs/[id]: o resumo da execução que a tela precisa para montar e retomar o acompanhamento.
// Lido com a sessão de quem está logado: só a própria pessoa vê a execução dela (execução de outra pessoa é
// "não encontrada"), e só o que ela pode ver: o pedido, status, plano das fases, resultado final, tempo, a estimativa
// reservada ao começar e quanto já foi cobrado (as linhas de gasto dela no extrato).
// DELETE { pageMemberId }: apaga a execução, se já parou (F64). A entrega e o extrato ficam.

import { signedInSession } from "../../../../lib/auth/session.js";
// O DELETE responde no formato das rotas do chat ({ problem }), que é como a aba Meu time lê.
import { chatProblem, pageCallerFromJson, SERVER_PROBLEM } from "../../../../lib/ock/chat-request.js";
import { deleteOwnRun } from "../../../../lib/runs/delete-run.js";
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

/**
 * @param {Request} request
 * @param {RouteContext<"/api/runs/[id]">} context
 * @returns {Promise<Response>}
 */
export async function DELETE(request, context) {
  const { id } = await context.params;
  const caller = await pageCallerFromJson(request);
  if (!caller.ok) return caller.response;
  if (!isRunId(id)) return chatProblem(404, "Execução não encontrada.");
  try {
    const result = await deleteOwnRun(caller.session, id);
    if (result === "not-found") return chatProblem(404, "Execução não encontrada.");
    if (result === "busy") return chatProblem(409, "Esta receita ainda está trabalhando. Abra e cancele antes de apagar.");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/runs] Falha ao apagar a execução ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

function problem(status, message) {
  return Response.json({ problems: [message] }, { status, headers: { "Cache-Control": "no-store" } });
}
