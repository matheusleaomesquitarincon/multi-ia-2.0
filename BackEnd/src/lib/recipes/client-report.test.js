import { describe, expect, it } from "vitest";
import { clientReportRecipe } from "./client-report.js";
import { SAMPLE_REPORT_ANALYSIS, SAMPLE_REPORT_FINAL } from "./client-report.samples.js";
import { NO_MADE_UP_DATA, TEXT_FORMAT_RULES } from "./text-format.js";
import { finalStep, stageSteps } from "./types.js";
import { findRecipeProblems } from "./validate.js";

const recipe = clientReportRecipe;

/** A etapa pelo identificador, procurando em todas as fases. */
function step(id) {
  const found = recipe.stages.flatMap(stageSteps).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Etapa não encontrada: ${id}`);
  return found;
}

/** De onde cada entrada de uma etapa vem, no formato "request" | "review" | id da etapa. */
function inputsOf(stepId) {
  return step(stepId).inputs.map((input) => (input.from === "step" ? input.stepId : input.from));
}

describe('receita "Relatório mensal para cliente" (F08)', () => {
  it("está bem montada", () => {
    expect(findRecipeProblems(recipe)).toEqual([]);
  });

  it("tem o time anunciado no cartão: Analista/Claude, Redator/GPT e Conferente/Claude, com reservas", () => {
    expect(recipe.roles.map((role) => [role.name, role.suggestedProvider, role.backupProvider])).toEqual([
      ["Analista", "claude", "gemini"],
      ["Redator", "gpt", "claude"],
      ["Conferente", "claude", "gemini"],
    ]);
  });

  it("roda 4 etapas, uma depois da outra: análise, relatório, conferência e versão final", () => {
    expect(recipe.stages.flatMap(stageSteps).map((s) => [s.id, s.roleId])).toEqual([
      ["analysis", "analyst"],
      ["draft", "writer"],
      ["check", "checker"],
      ["final", "writer"],
    ]);
    expect(recipe.stages.every((stage) => stage.kind === "sequential")).toBe(true);
  });

  it("quem confere é de outra família de IA que quem escreveu, inclusive a reserva (F57)", () => {
    const writer = recipe.roles.find((role) => role.id === "writer");
    const checker = recipe.roles.find((role) => role.id === "checker");
    expect(checker.suggestedProvider).not.toBe(writer.suggestedProvider);
    expect(checker.backupProvider).not.toBe(writer.suggestedProvider);
  });

  it("o conferente compara o relatório com os dados do pedido; a versão final aplica as correções dele", () => {
    expect(inputsOf("analysis")).toEqual(["request"]);
    expect(inputsOf("draft")).toEqual(["request", "analysis"]);
    expect(inputsOf("check")).toEqual(["request", "draft"]);
    expect(inputsOf("final")).toEqual(["request", "draft", "check"]);
    expect(step("check").instruction).toMatch(/Refaça cada conta/);
  });

  it('termina num texto que vira o Word "Relatório mensal", com o título da tela', () => {
    expect(finalStep(recipe)?.format).toBe("text");
    expect(recipe.documentName).toBe("Relatório mensal");
    expect(recipe.resultTitle).toBe("Seu relatório está pronto");
  });

  it("todos usam só os números do pedido; quem escreve segue as marcas do texto", () => {
    for (const s of recipe.stages.flatMap(stageSteps).filter((s) => s.id !== "check")) {
      expect(s.instruction).toContain("Use SÓ os números que vieram no pedido");
    }
    for (const id of ["draft", "final"]) expect(step(id).instruction).toContain(TEXT_FORMAT_RULES);
    expect(step("draft").instruction).toContain(NO_MADE_UP_DATA);
  });

  it("os exemplos da IA simulada fazem as contas certas e o final segue as marcas do texto", () => {
    // 270 ÷ 3.850 = 7,0%; 3.200 ÷ 15.200 = 21,1%; 15 ÷ 31 = 48,4%.
    for (const [delta, base, shown] of [
      [270, 3850, "7,0%"],
      [3200, 15200, "21,1%"],
      [15, 31, "48,4%"],
    ]) {
      expect(((delta / base) * 100).toFixed(1).replace(".", ",") + "%").toBe(shown);
      expect(SAMPLE_REPORT_ANALYSIS).toContain(shown);
    }
    expect(SAMPLE_REPORT_FINAL.startsWith("# ")).toBe(true);
  });

  it("as etapas têm limite de resposta e esforço definidos (a versão final, baixo)", () => {
    for (const s of recipe.stages.flatMap(stageSteps)) {
      expect(s.maxOutputTokens).toBeGreaterThan(0);
      expect(s.effort).toBeDefined();
    }
    expect(step("final").effort).toBe("low");
  });
});
