// DELETE /api/ock/account { pageMemberId, confirm: "APAGAR" }: o funcionário apaga a própria conta (F64, LGPD). O que
// some e o que fica está em lib/auth/delete-account.js. A pessoa precisa ser quem abriu a página (F34) e digitar
// APAGAR, para não apagar sem querer. Depois, o login deste navegador sai.

import { PAGE_MEMBER_FIELD } from "../../../../lib/auth/page-member.js";
import { createSessionClient } from "../../../../lib/auth/session.js";
import { deleteOwnAccount } from "../../../../lib/auth/delete-account.js";
import { chatProblem, pageCaller, SERVER_PROBLEM } from "../../../../lib/ock/chat-request.js";

/** O que a pessoa digita para confirmar. */
export const DELETE_ACCOUNT_WORD = "APAGAR";

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function DELETE(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return chatProblem(400, "Não entendemos o pedido enviado.");
  }
  const data = typeof body === "object" && body !== null ? body : {};
  const caller = await pageCaller(data[PAGE_MEMBER_FIELD]);
  if (!caller.ok) return caller.response;
  if (typeof data.confirm !== "string" || data.confirm.trim().toUpperCase() !== DELETE_ACCOUNT_WORD) {
    return chatProblem(400, `Para confirmar, digite ${DELETE_ACCOUNT_WORD}.`);
  }

  try {
    const result = await deleteOwnAccount(caller.me);
    if (result === "owner") {
      return chatProblem(
        403,
        "O dono não apaga a conta por aqui: a empresa toda depende dela. Fale com a gente para encerrar a empresa.",
      );
    }
    if (result === "busy") {
      return chatProblem(409, "Você tem uma receita ou resposta a caminho. Espere terminar (ou cancele) e tente de novo.");
    }
  } catch (error) {
    console.error("[api/ock/account] Falha ao apagar a conta:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }

  // O login já não existe; tira o cookie deste navegador. Se der erro aqui, o cookie não vale mais de qualquer jeito.
  try {
    const session = await createSessionClient();
    await session?.auth.signOut({ scope: "local" });
  } catch {
    // Nada a fazer: o login foi apagado.
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
