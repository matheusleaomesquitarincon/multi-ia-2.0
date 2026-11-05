import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route.js";

// Anexar um arquivo: só quem abriu a página, só os tipos que a IA lê e até 10 MB. O arquivo vai para a pasta da
// pessoa, com a empresa e a pessoa tiradas do login.

const state = vi.hoisted(() => ({ viewer: { status: "signed-out" }, stored: [] }));

vi.mock("../../../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../../../lib/auth/session.js", () => ({ signedInSession: async () => ({}) }));
vi.mock("../../../../lib/ock/files.js", async (importOriginal) => ({
  ...(await importOriginal()),
  storeFile: async (file) => {
    state.stored.push(file);
    return { id: "arquivo-1", name: file.name };
  },
}));

const CARLA = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Carla Dias",
  email: "carla@example.com",
  role: "employee",
  mustChangePassword: false,
};

function upload(file, pageMemberId = CARLA.id) {
  const form = new FormData();
  if (pageMemberId) form.append("pageMemberId", pageMemberId);
  if (file) form.append("file", file);
  return POST(new Request("http://localhost/api/ock/files", { method: "POST", body: form }));
}

beforeEach(() => {
  state.viewer = { status: "member", member: CARLA };
  state.stored = [];
});

describe("rota POST /api/ock/files (anexar)", () => {
  it("guarda o anexo na pasta de quem está logado, com o tipo tirado da extensão", async () => {
    const response = await upload(new File(["Olá"], "ata.txt", { type: "text/html" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ file: { id: "arquivo-1", name: "ata.txt" } });
    expect(state.stored).toHaveLength(1);
    expect(state.stored[0]).toMatchObject({
      companyId: CARLA.companyId,
      memberId: CARLA.id,
      kind: "upload",
      name: "ata.txt",
      mime: "text/plain",
    });
  });

  it("recusa um tipo que a IA não lê, com o aviso (F44)", async () => {
    const response = await upload(new File(["x"], "contrato.docx"));
    expect(response.status).toBe(415);
    expect((await response.json()).problem).toContain("ainda não lê este tipo de arquivo");
    expect(state.stored).toEqual([]);
  });

  it("recusa arquivo vazio ou maior que 10 MB", async () => {
    expect((await upload(new File([], "vazio.txt"))).status).toBe(400);
    expect((await upload(null)).status).toBe(400);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf");
    expect((await upload(big)).status).toBe(413);
    expect(state.stored).toEqual([]);
  });

  it("sem login, 401; com outra conta conectada, ou sem dizer quem abriu a página, 409 (F34)", async () => {
    state.viewer = { status: "signed-out" };
    expect((await upload(new File(["x"], "a.txt"))).status).toBe(401);
    state.viewer = { status: "member", member: { ...CARLA, id: "22222222-2222-4222-8222-222222222222" } };
    expect((await upload(new File(["x"], "a.txt"))).status).toBe(409);
    state.viewer = { status: "member", member: CARLA };
    expect((await upload(new File(["x"], "a.txt"), null)).status).toBe(409);
    expect(state.stored).toEqual([]);
  });
});
