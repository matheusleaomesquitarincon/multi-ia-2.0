import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({ closeStaleHolds: vi.fn() }));
vi.mock("./wallet.js", () => wallet);
const files = vi.hoisted(() => ({ removeOrphanFiles: vi.fn() }));
vi.mock("../ock/files.js", () => files);
const exchange = vi.hoisted(() => ({ refreshExchangeRate: vi.fn() }));
vi.mock("../platform/exchange.js", () => exchange);

import { runHousekeeping, startHousekeeping } from "./housekeeping.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_teste");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  wallet.closeStaleHolds.mockReset();
  files.removeOrphanFiles.mockReset();
  exchange.refreshExchangeRate.mockReset();
});

describe("limpeza periódica (F43)", () => {
  it("fecha as reservas esquecidas agora e depois a cada intervalo, até ser desligada", async () => {
    wallet.closeStaleHolds.mockResolvedValue(0);
    files.removeOrphanFiles.mockResolvedValue(0);
    const stop = startHousekeeping(1000);
    expect(wallet.closeStaleHolds).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(wallet.closeStaleHolds).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(wallet.closeStaleHolds).toHaveBeenCalledTimes(3);
  });

  it("sem o Supabase configurado, não liga", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    startHousekeeping(1000)();
    expect(wallet.closeStaleHolds).not.toHaveBeenCalled();
  });

  it("um erro do banco fica no terminal e não derruba o servidor", async () => {
    wallet.closeStaleHolds.mockRejectedValue(new Error("connection refused"));
    await expect(runHousekeeping()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("apaga os arquivos esquecidos na mesma rodada (F28)", async () => {
    wallet.closeStaleHolds.mockResolvedValue(0);
    files.removeOrphanFiles.mockResolvedValue(2);
    await runHousekeeping();
    expect(files.removeOrphanFiles).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Apaguei 2 arquivo(s)"));
  });

  it("o erro de uma tarefa não impede a outra", async () => {
    wallet.closeStaleHolds.mockRejectedValue(new Error("connection refused"));
    files.removeOrphanFiles.mockResolvedValue(0);
    await runHousekeeping();
    expect(files.removeOrphanFiles).toHaveBeenCalledTimes(1);

    wallet.closeStaleHolds.mockResolvedValue(1);
    files.removeOrphanFiles.mockRejectedValue(new Error("storage down"));
    await expect(runHousekeeping()).resolves.toBeUndefined();
    expect(wallet.closeStaleHolds).toHaveBeenCalledTimes(2);
  });
});

describe("câmbio da plataforma (F17)", () => {
  it("lê o câmbio de novo a cada rodada, e um erro nele não atrapalha o resto", async () => {
    wallet.closeStaleHolds.mockResolvedValue(0);
    files.removeOrphanFiles.mockResolvedValue(0);
    exchange.refreshExchangeRate.mockRejectedValue(new Error("banco fora do ar"));
    await runHousekeeping();
    expect(exchange.refreshExchangeRate).toHaveBeenCalledTimes(1);
    expect(wallet.closeStaleHolds).toHaveBeenCalledTimes(1);
    expect(files.removeOrphanFiles).toHaveBeenCalledTimes(1);
  });
});
