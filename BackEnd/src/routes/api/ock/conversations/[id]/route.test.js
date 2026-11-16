import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "./route.js";

// Apagar uma conversa (F28): só quem abriu a página, só a própria conversa, e nunca com uma resposta a caminho.

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const state = vi.hoisted(() => ({ viewer: { status: "signed-out" }, result: "deleted", calls: [] }));

vi.mock("../../../../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../../../../lib/auth/session.js", () => ({ signedInSession: async () => ({}) }));
vi.mock("../../../../../lib/ock/conversation-view.js", () => ({ loadConversationView: async () => null }));
vi.mock("../../../../../lib/ock/conversation-delete.js", () => ({
  deleteOwnConversation: async (_session, memberId, id) => {
    state.calls.push([memberId, id]);
    if (state.result instanceof Error) throw state.result;
    return state.result;
  },
}));

function remove(body, id = ID) {
  return DELETE(
    new Request(`http://localhost/api/ock/conversations/${id}`, { method: "DELETE", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  state.viewer = {
    status: "member",
    member: { id: "m1", companyId: "c1", name: "Carla", email: "c@example.com", role: "employee" },
  };
  state.result = "deleted";
  state.calls = [];
});

describe("rota DELETE /api/ock/conversations/[id] (F28)", () => {
  it("apaga a conversa de quem está logado", async () => {
    const response = await remove({ pageMemberId: "m1" });
    expect(response.status).toBe(200);
    expect(state.calls).toEqual([["m1", ID]]);
  });

  it("conversa de outra pessoa é 'não encontrada'; resposta a caminho é 409", async () => {
    state.result = "not-found";
    expect((await remove({ pageMemberId: "m1" })).status).toBe(404);
    state.result = "busy";
    const busy = await remove({ pageMemberId: "m1" });
    expect(busy.status).toBe(409);
    expect((await busy.json()).problem).toMatch(/Espere a resposta/);
  });

  it("id estranho, outra conta na aba (F34) ou sem login: nada é apagado", async () => {
    expect((await remove({ pageMemberId: "m1" }, "../x")).status).toBe(404);
    expect((await remove({ pageMemberId: "m2" })).status).toBe(409);
    state.viewer = { status: "signed-out" };
    expect((await remove({ pageMemberId: "m1" })).status).toBe(401);
    expect(state.calls).toEqual([]);
  });

  it("um erro do banco vira a mensagem de sempre, sem detalhes técnicos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.result = new Error("db down");
    const response = await remove({ pageMemberId: "m1" });
    expect(response.status).toBe(500);
    expect((await response.json()).problem).not.toMatch(/db down/);
  });
});
