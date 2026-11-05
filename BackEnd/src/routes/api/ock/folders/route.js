// As pastas ("tarefas") em que o funcionário organiza as entregas. Criar, renomear e apagar: cada um só mexe nas
// próprias (o banco confere pela sessão). Mover uma entrega para uma pasta é na rota /api/ock/deliveries (PATCH).

import { MAX_FOLDER_NAME } from "../../../../lib/ock/chat.js";
import { PAGE_MEMBER_FIELD } from "../../../../lib/auth/page-member.js";
import { chatProblem, isUuid, pageCaller, SERVER_PROBLEM } from "../../../../lib/ock/chat-request.js";
import { createFolder, deleteFolder, renameFolder } from "../../../../lib/ock/files.js";

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

function parseName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return { ok: false, problem: "Dê um nome para a tarefa." };
  if (name.length > MAX_FOLDER_NAME) {
    return { ok: false, problem: `O nome da tarefa passou de ${MAX_FOLDER_NAME} caracteres.` };
  }
  return { ok: true, name };
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const parsed = parseName(auth.data.name);
  if (!parsed.ok) return chatProblem(400, parsed.problem);
  try {
    const folder = await createFolder(auth.caller.session, {
      companyId: auth.caller.me.companyId,
      memberId: auth.caller.me.id,
      name: parsed.name,
    });
    return Response.json({ folder }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/folders] Falha ao criar a tarefa:", error);
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
  if (!isUuid(id)) return chatProblem(400, "Esta tarefa não foi encontrada.");
  const parsed = parseName(auth.data.name);
  if (!parsed.ok) return chatProblem(400, parsed.problem);
  try {
    const ok = await renameFolder(auth.caller.session, id, parsed.name);
    if (!ok) return chatProblem(404, "Não encontramos essa tarefa. Recarregue e tente de novo.");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/folders] Falha ao renomear a tarefa:", error);
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
  if (!isUuid(id)) return chatProblem(400, "Esta tarefa não foi encontrada.");
  try {
    const ok = await deleteFolder(auth.caller.session, id);
    if (!ok) return chatProblem(404, "Não encontramos essa tarefa.");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/folders] Falha ao apagar a tarefa:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}
