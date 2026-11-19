import { describe, expect, it } from "vitest";
import { brasiliaMonthStart, sumCosts } from "./panel.js";

describe("painel da plataforma", () => {
  it("conta o mês no horário de Brasília", () => {
    expect(brasiliaMonthStart(new Date("2026-11-18T12:00:00Z")).toISOString()).toBe("2026-11-01T03:00:00.000Z");
    // 1º de dezembro às 01:00 UTC ainda é 30 de novembro em Brasília.
    expect(brasiliaMonthStart(new Date("2026-12-01T01:00:00Z")).toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(brasiliaMonthStart(new Date("2026-12-01T03:00:00Z")).toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("soma o custo de todas as empresas", () => {
    const row = { calls: 2, failedCalls: 1, costUsd: 0.1, costCents: 55, failedCostCents: 5, billedCents: 60 };
    expect(sumCosts([row, { ...row, costUsd: 0.2 }])).toEqual({
      calls: 4,
      failedCalls: 2,
      costUsd: 0.3,
      costCents: 110,
      failedCostCents: 10,
      billedCents: 120,
    });
    expect(sumCosts([]).calls).toBe(0);
  });
});
