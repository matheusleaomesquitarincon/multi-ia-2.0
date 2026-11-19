// GET /api/ock/conversations/[id]: uma conversa de quem está logado, com as mensagens mais recentes, quanto cada uma
// custou, os anexos e os arquivos que as IAs fizeram. Conversa de outra pessoa é "não encontrada".
// DELETE: apaga a conversa, as mensagens e os anexos mandados nela (F28). As entregas e o extrato ficam.

import {
  chatCaller,
  chatProblem,
  isUuid,
  pageCallerFromJson,
  SERVER_PROBLEM,
} from "../../../../../lib/ock/chat-request.js";
import { deleteOwnConversation } from "../../../../../lib/ock/conversation-delete.js";
import { loadConversationView } from "../../../../../lib/ock/conversation-view.js";

const NOT_FOUND = "Esta conversa não foi encontrada.";

/**
 * @param {Request} _request
 * @param {RouteContext<"/api/ock/conversations/[id]">} context
 * @returns {Promise<Response>}
 */
export async function GET(_request, context) {
  const { id } = await context.params;
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    const view = await loadConversationView(caller.session, caller.me.id, id);
    if (!view) return chatProblem(404, NOT_FOUND);
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/conversations] Falha ao abrir a conversa ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

/**
 * @param {Request} request
 * @param {RouteContext<"/api/ock/conversations/[id]">} context
 * @returns {Promise<Response>}
 */
export async function DELETE(request, context) {
  const { id } = await context.params;
  const caller = await pageCallerFromJson(request);
  if (!caller.ok) return caller.response;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    const result = await deleteOwnConversation(caller.session, caller.me.id, id);
    if (result === "not-found") return chatProblem(404, NOT_FOUND);
    if (result === "busy") {
      return chatProblem(409, "Espere a resposta chegar para apagar esta conversa.");
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/conversations] Falha ao apagar a conversa ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}
