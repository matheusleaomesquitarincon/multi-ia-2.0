// Os times de IA da pessoa (receitas próprias, F08). Criar (POST), mudar (PATCH) e apagar (DELETE): o banco confere,
// pela sessão, que só quem criou mexe (ou o dono, nos da empresa). O time chega como a tela monta
// (lib/recipes/custom-form.js) e é conferido de novo aqui. A lista vem junto com a tela (/api/views/trabalho).

import { MAX_CUSTOM_RECIPES, parseCustomRecipe } from "../../../../lib/recipes/custom-form.js";
import {
  createCustomRecipe,
  deleteCustomRecipe,
  updateCustomRecipe,
} from "../../../../lib/ock/custom-recipes.js";
import { chatProblem, isUuid, pageCaller, SERVER_PROBLEM } from "../../../../lib/ock/chat-request.js";
import { PAGE_MEMBER_FIELD } from "../../../../lib/auth/page-member.js";

const NOT_FOUND = "Não encontramos esse time. Recarregue a página e tente de novo.";

/** Lê o corpo JSON e confere quem pede (precisa ser quem abriu a página, F34). */
async function authorize(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: chatProblem(400, "Não entendemos o pedido enviado.") };
  }
  const data = typeof body === "object" && body !== null ? body : {};
  const caller = await pageCaller(data[PAGE_MEMBER_FIELD]);
  if (!caller.ok) return { ok: false, response: caller.response };
  return { ok: true, data, caller };
}

function refuseForm(problems) {
  return Response.json({ problem: problems[0], problems }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

const ok = (body) => Response.json(body, { headers: { "Cache-Control": "no-store" } });

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const parsed = parseCustomRecipe(auth.data.recipe);
  if (!parsed.ok) return refuseForm(parsed.problems);
  try {
    const created = await createCustomRecipe(auth.caller.session, auth.caller.me.id, parsed.form);
    if (created === "limit") {
      return chatProblem(409, `Você já tem ${MAX_CUSTOM_RECIPES} times. Apague um para montar outro.`);
    }
    return ok({ id: created.id });
  } catch (error) {
    console.error("[api/ock/custom-recipes] Falha ao salvar o time:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function PATCH(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const id = auth.data.id;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  const parsed = parseCustomRecipe(auth.data.recipe);
  if (!parsed.ok) return refuseForm(parsed.problems);
  try {
    if (!(await updateCustomRecipe(auth.caller.session, id, parsed.form))) return chatProblem(404, NOT_FOUND);
    return ok({ ok: true });
  } catch (error) {
    console.error("[api/ock/custom-recipes] Falha ao mudar o time:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function DELETE(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const id = auth.data.id;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    if (!(await deleteCustomRecipe(auth.caller.session, id))) return chatProblem(404, NOT_FOUND);
    return ok({ ok: true });
  } catch (error) {
    console.error("[api/ock/custom-recipes] Falha ao apagar o time:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}
