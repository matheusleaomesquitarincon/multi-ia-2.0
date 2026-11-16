// GET /api/ock/my-day: a aba "Meu time" (F08). O uso de cada dia, as receitas pendentes e as recentes de quem está
// logado. Lido com a sessão da pessoa: o banco só devolve o que é dela.

import { chatCaller, chatProblem, SERVER_PROBLEM } from "../../../../lib/ock/chat-request.js";
import { loadMyDay } from "../../../../lib/ock/my-day.js";

/**
 * @returns {Promise<Response>}
 */
export async function GET() {
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  try {
    return Response.json(await loadMyDay(caller.session), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/my-day] Falha ao montar a aba Meu time:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}
