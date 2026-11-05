import { describe, expect, it, vi } from "vitest";

import { GET } from "./route.js";

// As entregas são só as da própria pessoa: o dono, que pela sessão enxerga as da empresa toda, também vê só as dele.

const state = vi.hoisted(() => ({ viewer: { status: "signed-out" }, asked: [] }));

vi.mock("../../../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../../../lib/auth/session.js", () => ({ signedInSession: async () => ({}) }));
vi.mock("../../../../lib/ock/files.js", () => ({
  listOwnDeliveries: async (_session, memberId) => {
    state.asked.push(memberId);
    return [{ id: "a1", name: "relatorio.pdf", createdAt: "2026-10-25T10:00:00Z", folderId: null }];
  },
  listFolders: async () => [],
}));

describe("rota GET /api/ock/deliveries", () => {
  it("lista as entregas de quem está logado, mesmo quando é o dono", async () => {
    state.viewer = {
      status: "member",
      member: {
        id: "dona",
        companyId: "c1",
        companyName: "Doce Encanto",
        name: "Marina",
        email: "m@example.com",
        role: "owner",
        mustChangePassword: false,
      },
    };
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deliveries: [{ id: "a1", name: "relatorio.pdf", createdAt: "2026-10-25T10:00:00Z", folderId: null }],
      folders: [],
    });
    expect(state.asked).toEqual(["dona"]);
  });

  it("sem login, 401", async () => {
    state.viewer = { status: "signed-out" };
    expect((await GET()).status).toBe(401);
  });
});
