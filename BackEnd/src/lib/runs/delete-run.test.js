import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ loadOwnRun: vi.fn() }));
const wallet = vi.hoisted(() => ({ closeRunHolds: vi.fn() }));
vi.mock("./store.js", () => store);
vi.mock("./wallet.js", () => wallet);

import { deleteOwnRun } from "./delete-run.js";

// Apagar uma receita rodada (F64): só as que pararam; a pausada devolve a reserva antes de sumir.

const RUN = "0f8fad5b-d9cb-469f-a165-70867728950e";

function fakeSession(deleted = [{ id: RUN }]) {
  const calls = [];
  const builder = {
    delete: () => builder,
    eq: (column, value) => {
      calls.push([column, value]);
      return builder;
    },
    select: () => Promise.resolve({ data: deleted, error: null }),
  };
  return { session: { from: () => builder }, calls };
}

beforeEach(() => {
  store.loadOwnRun.mockReset();
  wallet.closeRunHolds.mockReset().mockResolvedValue(undefined);
});

describe("apagar uma receita rodada (F64)", () => {
  it("apaga a que terminou, sem mexer na carteira", async () => {
    store.loadOwnRun.mockResolvedValue({ id: RUN, status: "finished" });
    const { session, calls } = fakeSession();
    expect(await deleteOwnRun(session, RUN)).toBe("deleted");
    expect(calls).toEqual([["id", RUN]]);
    expect(wallet.closeRunHolds).not.toHaveBeenCalled();
  });

  it("a pausada devolve o dinheiro reservado antes de sumir", async () => {
    store.loadOwnRun.mockResolvedValue({ id: RUN, status: "paused" });
    expect(await deleteOwnRun(fakeSession().session, RUN)).toBe("deleted");
    expect(wallet.closeRunHolds).toHaveBeenCalledWith(RUN);
  });

  it("na fila ou rodando, não apaga (precisa cancelar antes)", async () => {
    for (const status of ["queued", "running"]) {
      store.loadOwnRun.mockResolvedValue({ id: RUN, status });
      const { session, calls } = fakeSession();
      expect(await deleteOwnRun(session, RUN)).toBe("busy");
      expect(calls).toEqual([]);
    }
  });

  it("de outra pessoa (ou que não existe) é 'não encontrada'", async () => {
    store.loadOwnRun.mockResolvedValue(null);
    expect(await deleteOwnRun(fakeSession().session, RUN)).toBe("not-found");
  });
});
