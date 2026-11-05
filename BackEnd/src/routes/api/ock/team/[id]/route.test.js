import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route.js";

// O "Ver o que fez" do painel: só o dono pede, e só de quem o banco devolve (a equipe da empresa dele).

const MEMBER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const DETAILS = {
  lines: [
    {
      id: 7,
      kind: "charge",
      memberId: MEMBER_ID,
      recipe: true,
      description: "Criar um site",
      providers: ["claude", "gpt"],
      amountCents: -37,
      createdAt: "2026-10-25T10:00:00Z",
    },
  ],
  more: false,
  deliveries: [{ id: "a1", name: "doce-encanto.html", createdAt: "2026-10-25T10:00:00Z", folderId: null }],
};

const state = vi.hoisted(() => ({
  viewer: { status: "signed-out" },
  /** As pessoas que o banco devolve para quem pede. */
  visible: [],
}));

vi.mock("../../../../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../../../../lib/auth/session.js", () => ({ signedInSession: async () => ({}) }));
vi.mock("../../../../../lib/ock/spending.js", () => ({
  loadMemberMonths: async (_session, id) =>
    state.visible.includes(id)
      ? [{ memberId: id, spentCents: 37, reservedCents: 0, quickTasks: 0, recipes: 1, deliveries: 1 }]
      : [],
  loadMemberMonthDetails: async () => DETAILS,
}));

function get(id = MEMBER_ID) {
  return GET(new Request(`http://localhost/api/ock/team/${id}`), { params: Promise.resolve({ id }) });
}

function signIn(role) {
  state.viewer = {
    status: "member",
    member: {
      id: "m1",
      companyId: "c1",
      companyName: "Doce Encanto",
      name: "Marina",
      email: "m@example.com",
      role,
      mustChangePassword: false,
    },
  };
}

beforeEach(() => {
  signIn("owner");
  state.visible = [MEMBER_ID];
});

describe("rota GET /api/ock/team/[id]", () => {
  it("o dono recebe as linhas do mês e as entregas da pessoa", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DETAILS);
  });

  it("o funcionário não pede o mês de ninguém (403)", async () => {
    signIn("employee");
    expect((await get()).status).toBe(403);
  });

  it("quem não é da empresa do dono não aparece (404)", async () => {
    state.visible = [];
    expect((await get()).status).toBe(404);
  });

  it("um id fora do formato nem chega ao banco (404)", async () => {
    expect((await get("nao-e-um-id")).status).toBe(404);
  });

  it("sem login, 401", async () => {
    state.viewer = { status: "signed-out" };
    expect((await get()).status).toBe(401);
  });
});
