import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({ closeStaleHolds: vi.fn() }));
vi.mock("./wallet.js", () => wallet);

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
});

describe("limpeza periódica (F43)", () => {
  it("fecha as reservas esquecidas agora e depois a cada intervalo, até ser desligada", async () => {
    wallet.closeStaleHolds.mockResolvedValue(0);
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
});
