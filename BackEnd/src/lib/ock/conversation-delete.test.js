import { beforeEach, describe, expect, it, vi } from "vitest";

const files = vi.hoisted(() => ({ deleteTaskUploads: vi.fn(), removeStoredFiles: vi.fn() }));
vi.mock("./files.js", () => files);

import { deleteOwnConversation } from "./conversation-delete.js";

// Apagar uma conversa (F28): some a conversa, as mensagens (cascata do banco) e os anexos; as entregas ficam. Com uma
// resposta a caminho, não apaga.

const NOW = Date.parse("2026-11-16T12:00:00Z");
const MEMBER = "m1";
const CONVERSATION = "0f8fad5b-d9cb-469f-a165-70867728950e";

/** Um banco de mentira: guarda os filtros de cada pedido e devolve o que o teste mandou. */
function fakeSession({ tasks = [], deleted = [{ id: CONVERSATION }] } = {}) {
  const calls = [];
  const session = {
    from(table) {
      const call = { table, op: "select", filters: [] };
      calls.push(call);
      const builder = {
        select: () => builder,
        delete: () => {
          call.op = "delete";
          return builder;
        },
        eq: (column, value) => {
          call.filters.push([column, value]);
          return builder;
        },
        then: (resolve) =>
          resolve({ data: table === "tasks" ? tasks : deleted, error: null }),
      };
      return builder;
    },
  };
  return { session, calls };
}

const at = (minutesAgo) => new Date(NOW - minutesAgo * 60_000).toISOString();

beforeEach(() => {
  files.deleteTaskUploads.mockReset().mockResolvedValue(["c1/m1/a-anexo.pdf"]);
  files.removeStoredFiles.mockReset().mockResolvedValue(undefined);
});

describe("apagar uma conversa (F28)", () => {
  it("apaga os anexos das mensagens, a conversa e depois o conteúdo da pasta", async () => {
    const { session, calls } = fakeSession({
      tasks: [
        { id: "t1", status: "finished", created_at: at(30) },
        { id: "t2", status: "failed", created_at: at(20) },
      ],
    });
    expect(await deleteOwnConversation(session, MEMBER, CONVERSATION, NOW)).toBe("deleted");
    expect(files.deleteTaskUploads).toHaveBeenCalledWith(session, MEMBER, ["t1", "t2"]);
    const remove = calls.find((call) => call.table === "conversations");
    expect(remove.op).toBe("delete");
    expect(remove.filters).toEqual([
      ["id", CONVERSATION],
      ["member_id", MEMBER],
    ]);
    expect(files.removeStoredFiles).toHaveBeenCalledWith(["c1/m1/a-anexo.pdf"]);
  });

  it("com uma resposta a caminho, não apaga nada", async () => {
    const { session, calls } = fakeSession({ tasks: [{ id: "t1", status: "running", created_at: at(1) }] });
    expect(await deleteOwnConversation(session, MEMBER, CONVERSATION, NOW)).toBe("busy");
    expect(files.deleteTaskUploads).not.toHaveBeenCalled();
    expect(calls.some((call) => call.op === "delete")).toBe(false);
  });

  it("uma resposta que parou no meio (o servidor caiu) não segura o apagar", async () => {
    const { session } = fakeSession({ tasks: [{ id: "t1", status: "running", created_at: at(30) }] });
    expect(await deleteOwnConversation(session, MEMBER, CONVERSATION, NOW)).toBe("deleted");
  });

  it("conversa de outra pessoa (ou que não existe) é 'não encontrada'", async () => {
    files.deleteTaskUploads.mockResolvedValue([]);
    const { session } = fakeSession({ tasks: [], deleted: [] });
    expect(await deleteOwnConversation(session, MEMBER, CONVERSATION, NOW)).toBe("not-found");
  });
});
