// POST /api/runs/[id]/cancel { pageMemberId }: a pessoa cancelou a própria execução (ou, numa pausa, mandou parar).
// Só quem começou cancela: a execução é procurada com a sessão de quem está logado (a de outra pessoa nem aparece),
// e o login tem de ser o de quem abriu a página (F34). Marca 'cancelled' e anexa um evento de cancelamento à narração.
// Quem estiver rodando a fase percebe em poucos segundos e para a IA no meio; a corrente de fases para junto, e quem
// rodava fecha a reserva na carteira. Se ninguém está rodando (entre duas fases, ou numa pausa), fecha aqui mesmo.
// A pessoa paga só as etapas concluídas: o que sobrou da reserva volta ao saldo.

import { checkPageMember, PAGE_MEMBER_FIELD } from "../../../../../lib/auth/page-member.js";
import { createSessionClient } from "../../../../../lib/auth/session.js";
import { getViewer } from "../../../../../lib/auth/viewer.js";
import { getRecipe } from "../../../../../lib/recipes/catalog.js";
import { stageSteps } from "../../../../../lib/recipes/types.js";
import { isPlainObject, isRunId } from "../../../../../lib/runs/parse-request.js";
import { appendEvents, cancelRun, FINAL_STATUSES, loadOwnRun } from "../../../../../lib/runs/store.js";
import { closeRunHolds } from "../../../../../lib/runs/wallet.js";

/**
 * @param {Request} request
 * @param {RouteContext<"/api/runs/[id]/cancel">} context
 * @returns {Promise<Response>}
 */
export async function POST(request, context) {
  const { id } = await context.params;

  // Só aceita JSON, como a rota de começar: outro site não consegue cancelar pelo navegador de alguém.
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return problem(415, "Formato de pedido não aceito.");

  let body;
  try {
    body = await request.json();
  } catch {
    return problem(400, "Não entendemos o pedido enviado.");
  }

  const check = checkPageMember(await getViewer(), isPlainObject(body) ? body[PAGE_MEMBER_FIELD] : undefined);
  if (!check.ok) return problem(check.status, check.message);

  const session = await createSessionClient();
  if (!session || !isRunId(id)) return problem(404, "Execução não encontrada.");

  try {
    // Pela sessão: só aparece se a execução for de quem está logado.
    const run = await loadOwnRun(session, id);
    if (!run) return problem(404, "Execução não encontrada.");

    // Já acabou? Nada a fazer; devolve o status atual.
    if (FINAL_STATUSES.includes(run.status)) return Response.json({ status: run.status });

    const cancelled = await cancelRun(id);
    if (cancelled) {
      await appendEvents({ id, company_id: check.me.companyId }, [
        { type: "run-cancelled", stepId: cancelledStepId(run.recipe_id, run.cursor.stageIndex) },
      ]);
      if (!isBeingRun(cancelled.leaseUntil)) await closeRunHolds(id);
    }
    return Response.json({ status: "cancelled" });
  } catch (error) {
    console.error(`[api/runs/cancel] Falha ao cancelar ${id}:`, error);
    return problem(500, "Não deu para cancelar agora. Tente de novo.");
  }
}

/**
 * Se algum servidor está rodando a execução agora (a reserva de quem roda ainda vale). Quem roda renova a reserva para
 * um minuto à frente a cada 2 segundos, então a diferença de alguns segundos entre os relógios não muda a resposta.
 */
function isBeingRun(leaseUntil) {
  return leaseUntil !== null && Date.parse(leaseUntil) > Date.now();
}

/** A etapa que a tela marca como parada: a primeira da fase em que a execução estava. */
function cancelledStepId(recipeId, stageIndex) {
  const recipe = getRecipe(recipeId);
  const stage = recipe?.stages[stageIndex];
  return stage ? stageSteps(stage)[0].id : "";
}

function problem(status, message) {
  return Response.json({ problems: [message] }, { status });
}
