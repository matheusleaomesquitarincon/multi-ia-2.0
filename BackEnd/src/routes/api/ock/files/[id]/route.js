// GET /api/ock/files/[id]: baixa um arquivo. O servidor confere pela sessão de quem está logado que a pessoa pode ver
// o arquivo (os dela e, para o dono, as entregas da empresa) e manda para um link de poucos minutos, que sempre baixa:
// nem um arquivo feito pela IA abre como página (AGENTS.md, seção 6).

import {
  chatCaller,
  chatProblem,
  isUuid,
  pageCallerFromJson,
  SERVER_PROBLEM,
} from "../../../../../lib/ock/chat-request.js";
import { deleteOwnFile, downloadLink, loadVisibleFile } from "../../../../../lib/ock/files.js";

const NOT_FOUND = "Arquivo não encontrado.";

/**
 * @param {Request} _request
 * @param {RouteContext<"/api/ock/files/[id]">} context
 * @returns {Promise<Response>}
 */
export async function GET(_request, context) {
  const { id } = await context.params;
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    const file = await loadVisibleFile(caller.session, id);
    if (!file) return chatProblem(404, NOT_FOUND);
    const link = await downloadLink(file);
    return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/files] Falha ao baixar o arquivo ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

/**
 * DELETE /api/ock/files/[id]: apaga um arquivo da própria pessoa, o registro e o conteúdo (F28, LGPD). Arquivo de
 * outra pessoa (inclusive, para o dono, a entrega de um funcionário) é "não encontrado".
 * @param {Request} request
 * @param {RouteContext<"/api/ock/files/[id]">} context
 * @returns {Promise<Response>}
 */
export async function DELETE(request, context) {
  const { id } = await context.params;
  const caller = await pageCallerFromJson(request);
  if (!caller.ok) return caller.response;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    const ok = await deleteOwnFile(caller.session, caller.me.id, id);
    if (!ok) return chatProblem(404, NOT_FOUND);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/files] Falha ao apagar o arquivo ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}
