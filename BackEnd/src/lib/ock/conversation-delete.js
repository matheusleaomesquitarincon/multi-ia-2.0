// Apagar uma conversa do chat (F28, LGPD: a pessoa pode apagar o que fez). SÓ do servidor. Tudo pela sessão de quem
// está logado, então só a própria pessoa apaga as conversas dela.
//
// O que some: a conversa, as mensagens (pedidos e respostas, apagadas em cascata pelo banco) e os anexos que a pessoa
// mandou nelas, registro e conteúdo. O que fica: as entregas (continuam na aba Entregas, onde a pessoa apaga se quiser)
// e as linhas de gasto do extrato, que nunca se apagam (o dono acompanha o gasto por elas).

import { STALE_TASK_MS } from "./conversation-view.js";
import { deleteTaskUploads, removeStoredFiles } from "./files.js";

/** @typedef {"deleted" | "not-found" | "busy"} DeleteConversationResult */

/**
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @param {string} conversationId
 * @param {number} [now]
 * @returns {Promise<DeleteConversationResult>}
 */
export async function deleteOwnConversation(session, memberId, conversationId, now = Date.now()) {
  const { data: tasks, error } = await session
    .from("tasks")
    .select("id, status, created_at")
    .eq("conversation_id", conversationId)
    .eq("member_id", memberId);
  if (error) throw error;
  const rows = tasks ?? [];

  // Com uma resposta a caminho, apagar agora deixaria a reserva dela aberta e a resposta sem lugar para ser gravada.
  // Uma mensagem "respondendo" há mais tempo que o normal parou no meio (o servidor caiu) e não segura nada.
  const answering = rows.some(
    (row) => row.status === "running" && now - Date.parse(row.created_at) <= STALE_TASK_MS,
  );
  if (answering) return "busy";

  const paths = await deleteTaskUploads(
    session,
    memberId,
    rows.map((row) => row.id),
  );
  const { data, error: deleteError } = await session
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("member_id", memberId)
    .select("id");
  if (deleteError) throw deleteError;
  await removeStoredFiles(paths);
  return (data ?? []).length > 0 ? "deleted" : "not-found";
}
