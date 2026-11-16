import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "./route.js";

// Apagar a própria conta (F64): só quem abriu a página, só digitando APAGAR, e nunca a do dono.

const state = vi.hoisted(() => ({ viewer: { status: "signed-out" }, result: "deleted", calls: 0, signedOut: 0 }));

vi.mock("../../../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../../../lib/auth/session.js", () => ({
  signedInSession: async () => ({}),
  createSessionClient: async () => ({
    auth: {
      signOut: async () => {
        state.signedOut++;
      },
    },
  }),
}));
vi.mock("../../../../lib/auth/delete-account.js", () => ({
  deleteOwnAccount: async () => {
    state.calls++;
    return state.result;
  },
}));

function remove(body) {
  return DELETE(new Request("http://localhost/api/ock/account", { method: "DELETE", body: JSON.stringify(body) }));
}

beforeEach(() => {
  state.viewer = {
    status: "member",
    member: { id: "m1", companyId: "c1", name: "Carla", email: "c@example.com", role: "employee" },
  };
  state.result = "deleted";
  state.calls = 0;
  state.signedOut = 0;
});

describe("rota DELETE /api/ock/account (F64)", () => {
  it("com APAGAR, apaga a conta e tira o login deste navegador", async () => {
    const response = await remove({ pageMemberId: "m1", confirm: "apagar " });
    expect(response.status).toBe(200);
    expect(state.calls).toBe(1);
    expect(state.signedOut).toBe(1);
  });

  it("sem digitar APAGAR, nada acontece", async () => {
    const response = await remove({ pageMemberId: "m1", confirm: "sim" });
    expect(response.status).toBe(400);
    expect((await response.json()).problem).toMatch(/digite APAGAR/);
    expect(state.calls).toBe(0);
  });

  it("outra conta na aba (F34) ou sem login: nada acontece", async () => {
    expect((await remove({ pageMemberId: "m2", confirm: "APAGAR" })).status).toBe(409);
    state.viewer = { status: "signed-out" };
    expect((await remove({ pageMemberId: "m1", confirm: "APAGAR" })).status).toBe(401);
    expect(state.calls).toBe(0);
  });

  it("o dono é recusado; com trabalho a caminho, espera", async () => {
    state.result = "owner";
    expect((await remove({ pageMemberId: "m1", confirm: "APAGAR" })).status).toBe(403);
    state.result = "busy";
    expect((await remove({ pageMemberId: "m1", confirm: "APAGAR" })).status).toBe(409);
    expect(state.signedOut).toBe(0);
  });
});
