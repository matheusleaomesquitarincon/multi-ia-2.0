import { describe, expect, it } from "vitest";
import { STALE_TASK_ANSWER, taskView } from "./conversation-view.js";

const ROW = {
  id: "t1",
  prompt: "Pesquise o preço do café",
  answer: "Uns R$ 30 o quilo.",
  status: "finished",
  action: "pesquisa",
  chosen_provider: "gemini",
  chosen_tier: "economico",
  chosen_effort: "low",
  created_at: "2026-10-25T10:00:00Z",
};

const EXTRAS = { costCents: 2, attachments: [], deliveries: [], chart: null, now: Date.parse("2026-10-25T10:01:00Z") };

describe("uma mensagem guardada, do jeito que a tela mostra", () => {
  it("traz a IA que fez, quanto custou e o aviso do tipo de resposta", () => {
    expect(taskView(ROW, EXTRAS)).toMatchObject({
      id: "t1",
      status: "finished",
      provider: "gemini",
      tier: "economico",
      effort: "low",
      costCents: 2,
      reason: null,
      notice: expect.stringContaining("não veio de uma pesquisa na internet"),
    });
  });

  it("uma resposta pesquisada na internet (com as fontes no fim) não leva o aviso", () => {
    const researched = {
      ...ROW,
      answer: "O dólar fechou em alta.\n\nFontes consultadas:\n- Jornal: https://example.com/a",
    };
    expect(taskView(researched, EXTRAS).notice).toBeNull();
  });

  it("com o registro do que a IA usou, o aviso lê o registro, não o fim do texto (F53)", () => {
    // A IA não pesquisou, mas terminou a resposta com uma lista de fontes inventada, no formato exato.
    const invented = {
      ...ROW,
      answer: "O dólar fechou em alta.\n\nFontes consultadas:\n- Jornal: https://example.com/a",
      researched: false,
      ran_code: false,
    };
    expect(taskView(invented, EXTRAS).notice).toContain("não veio de uma pesquisa na internet");
    expect(taskView({ ...invented, researched: true }, EXTRAS).notice).toBeNull();
    const code = { ...ROW, action: "codigo", answer: "Dá 1.268,25.", researched: false, ran_code: true };
    expect(taskView(code, EXTRAS).notice).toBeNull();
  });

  it("uma mensagem que ficou respondendo por mais de 6 minutos parou no meio: aparece como falha, sem cobrança", () => {
    const running = { ...ROW, status: "running", answer: null };
    expect(taskView(running, EXTRAS)).toMatchObject({ status: "running", answer: null });
    const later = { ...EXTRAS, now: Date.parse("2026-10-25T10:07:00Z") };
    expect(taskView(running, later)).toMatchObject({ status: "failed", answer: STALE_TASK_ANSWER, notice: null });
  });
});
