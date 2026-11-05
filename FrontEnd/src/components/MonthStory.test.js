import { describe, expect, it, vi } from "vitest";

vi.mock("./Reveal.jsx", () => ({ Reveal: () => null }));
vi.mock("./MonthStory.module.css", () => ({ default: {} }));

const { monthChapters } = await import("./MonthStory.jsx");

const credit = (over = {}) => ({
  availableCents: 10000,
  monthSpentCents: 0,
  byProvider: [],
  ...over,
});

const base = { topupCents: 0, topupPartial: false, runs: 0, deliveries: 0, topPerson: null };
const textOf = (chapters, id) => chapters.find((chapter) => chapter.id === id).text;

describe("a história do mês", () => {
  it("num mês vazio, diz que nada aconteceu, sem inventar nada", () => {
    const chapters = monthChapters({ ...base, credit: credit() });
    expect(textOf(chapters, "entrou")).toBe("Nenhuma recarga entrou neste mês ainda.");
    expect(textOf(chapters, "fez")).toBe("Ninguém usou as IAs neste mês ainda.");
    expect(textOf(chapters, "gastou")).toBe("Ninguém da equipe gastou neste mês ainda.");
  });

  it("aponta a IA mais usada e quem mais gastou", () => {
    const chapters = monthChapters({
      ...base,
      runs: 3,
      deliveries: 1,
      topPerson: { name: "Ana", spentCents: 1500 },
      credit: credit({
        monthSpentCents: 2000,
        byProvider: [
          { provider: "gpt", spentCents: 500 },
          { provider: "claude", spentCents: 1500 },
          { provider: null, spentCents: 900 },
        ],
      }),
    });
    expect(textOf(chapters, "gastou")).toContain("Claude");
    expect(textOf(chapters, "gastou")).toContain("Ana");
    expect(textOf(chapters, "fez")).toBe("E 1 entrega para baixar.");
  });

  it("sem crédito, avisa em vez de mostrar saldo negativo", () => {
    const chapters = monthChapters({ ...base, credit: credit({ availableCents: -50 }) });
    const now = chapters.find((chapter) => chapter.id === "agora");
    expect(now.alert).toBe(true);
    expect(now.figure).not.toContain("-");
  });
});
