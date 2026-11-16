import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET } from "./route.js";

// Baixar: o arquivo é procurado com a sessão de quem está logado (o banco só devolve o que a pessoa pode ver) e a
// pessoa vai para um link que só baixa.

const FILE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const state = vi.hoisted(() => ({ viewer: { status: "signed-out" }, file: null, deleted: [] }));

vi.mock("../../../../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../../../../lib/auth/session.js", () => ({ signedInSession: async () => ({}) }));
vi.mock("../../../../../lib/ock/files.js", () => ({
  loadVisibleFile: async (_session, id) => (state.file?.id === id ? state.file : null),
  deleteOwnFile: async (_session, memberId, id) => {
    if (state.file?.id !== id || state.file.member_id !== memberId) return false;
    state.deleted.push(id);
    return true;
  },
  downloadLink: async (file) => `https://armazem.example/${file.storage_path}?download=${file.name}`,
}));

function get(id = FILE_ID) {
  return GET(new Request(`http://localhost/api/ock/files/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  state.deleted = [];
  state.viewer = {
    status: "member",
    member: {
      id: "m1",
      companyId: "c1",
      companyName: "Doce Encanto",
      name: "Carla",
      email: "c@example.com",
      role: "employee",
      mustChangePassword: false,
    },
  };
  state.file = {
    id: FILE_ID,
    member_id: "m1",
    kind: "delivery",
    name: "relatorio.pdf",
    storage_path: "c1/m1/x-relatorio.pdf",
    mime_type: "application/pdf",
    size_bytes: 100,
    task_id: null,
    created_at: "2026-10-25T10:00:00Z",
  };
});

describe("rota GET /api/ock/files/[id] (baixar)", () => {
  it("manda para o link de baixar, sem guardar a resposta", async () => {
    const response = await get();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://armazem.example/c1/m1/x-relatorio.pdf?download=relatorio.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("arquivo que a pessoa não pode ver (ou id estranho) é 'não encontrado'; sem login, 401", async () => {
    state.file = null;
    expect((await get()).status).toBe(404);
    expect((await get("../../segredo")).status).toBe(404);
    state.viewer = { status: "signed-out" };
    expect((await get()).status).toBe(401);
  });
});

function remove(body, id = FILE_ID) {
  return DELETE(
    new Request(`http://localhost/api/ock/files/${id}`, { method: "DELETE", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
}

describe("rota DELETE /api/ock/files/[id] (apagar, F28)", () => {
  it("apaga o arquivo da própria pessoa", async () => {
    const response = await remove({ pageMemberId: "m1" });
    expect(response.status).toBe(200);
    expect(state.deleted).toEqual([FILE_ID]);
  });

  it("arquivo de outra pessoa (ou id estranho) é 'não encontrado' e nada é apagado", async () => {
    state.file.member_id = "outra";
    expect((await remove({ pageMemberId: "m1" })).status).toBe(404);
    expect((await remove({ pageMemberId: "m1" }, "../x")).status).toBe(404);
    expect(state.deleted).toEqual([]);
  });

  it("com outra conta conectada nesta aba (F34), ou sem o corpo, nada é feito", async () => {
    expect((await remove({ pageMemberId: "m2" })).status).toBe(409);
    expect((await remove({})).status).toBe(409);
    const broken = await DELETE(new Request("http://localhost/x", { method: "DELETE", body: "{" }), {
      params: Promise.resolve({ id: FILE_ID }),
    });
    expect(broken.status).toBe(400);
    expect(state.deleted).toEqual([]);
  });
});
