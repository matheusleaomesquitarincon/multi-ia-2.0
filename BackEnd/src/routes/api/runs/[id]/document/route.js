// GET /api/runs/[id]/document: baixa em Word o resultado em texto de uma receita terminada (ex.: a proposta
// comercial). Lido com a sessão de quem está logado: só a própria pessoa baixa o resultado dela (de outra pessoa, "não
// encontrado"). O Word é montado na hora a partir do resultado guardado, igual ao que vai para as entregas, e sempre
// sai como anexo, que o navegador só salva.

import { signedInSession } from "../../../../../lib/auth/session.js";
import { getRecipe } from "../../../../../lib/recipes/catalog.js";
import { finalDocument } from "../../../../../lib/runs/delivery.js";
import { isRunId } from "../../../../../lib/runs/parse-request.js";
import { loadOwnRun } from "../../../../../lib/runs/store.js";

const NOT_FOUND = "Este arquivo não foi encontrado.";

/**
 * @param {Request} _request
 * @param {RouteContext<"/api/runs/[id]/document">} context
 * @returns {Promise<Response>}
 */
export async function GET(_request, context) {
  const { id } = await context.params;
  const session = await signedInSession();
  if (!session) return problem(401, "Entre de novo para baixar este arquivo.");
  if (!isRunId(id)) return problem(404, NOT_FOUND);

  try {
    const run = await loadOwnRun(session, id);
    const recipe = run ? getRecipe(run.recipe_id) : undefined;
    if (!run || !recipe || run.status !== "finished") return problem(404, NOT_FOUND);
    const doc = await finalDocument(recipe, run.result);
    if (!doc) return problem(404, NOT_FOUND);
    return new Response(new Uint8Array(doc.bytes), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `attachment; filename="${doc.name}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`[api/runs/document] Falha ao montar o Word da execução ${id}:`, error);
    return problem(500, "Algo deu errado do nosso lado.");
  }
}

function problem(status, message) {
  return Response.json({ problems: [message] }, { status, headers: { "Cache-Control": "no-store" } });
}
