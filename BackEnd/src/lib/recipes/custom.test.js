import { describe, expect, it } from "vitest";

import { findRunProblems } from "../engine/validate.js";
import { chargeDescription } from "../runs/billing.js";
import { finalDocument } from "../runs/delivery.js";
import { stepCosts } from "../runs/estimate.js";
import { customRecipeFromSnapshot } from "../runs/recipe-of-run.js";
import { buildCustomRecipe, customRecipeDbId, customRecipeId } from "./custom.js";
import { MAX_INSTRUCTION, MAX_MEMBERS, MEMBER_TEMPLATES, parseCustomRecipe } from "./custom-form.js";
import { findRecipeProblems } from "./validate.js";
import { stageSteps } from "./types.js";

// A receita própria (F08): o time que o funcionário monta vira uma receita no formato das prontas, para o mesmo motor.

const ID = "11111111-1111-4111-8111-111111111111";

/** @type {CustomRecipeForm} */
const FORM = {
  name: "Post do blog da clínica",
  visibility: "private",
  members: [
    { name: "Pesquisador", provider: "claude", instruction: "Levante os pontos principais do tema." },
    { name: "Redator", provider: "gpt", instruction: "Escreva o post com base na pesquisa." },
    { name: "Revisor", provider: "gemini", instruction: "Revise o texto e entregue a versão final." },
  ],
};

describe("conferir a receita própria que chega (parseCustomRecipe)", () => {
  it("aceita um time bem montado e tira os espaços das pontas", () => {
    const result = parseCustomRecipe({
      ...FORM,
      name: "  Post do blog da clínica  ",
      members: FORM.members.map((member) => ({ ...member, name: ` ${member.name} ` })),
    });
    expect(result).toEqual({ ok: true, form: FORM });
  });

  it("sem dizer quem vê, fica só para quem montou", () => {
    const result = parseCustomRecipe({ name: FORM.name, members: FORM.members });
    expect(result.ok && result.form.visibility).toBe("private");
  });

  it("explica cada problema em português", () => {
    const result = parseCustomRecipe({
      name: "",
      visibility: "todo mundo",
      members: [{ name: "", provider: "llama", instruction: "curto" }],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems).toEqual([
      "Dê um nome para o time.",
      "Escolha quem pode usar o time: só você ou a empresa toda.",
      "O time precisa de pelo menos 2 membros.",
      "Dê um nome para o membro 1.",
      "Escolha a IA do membro 1.",
      "Conte o que o membro 1 faz (pelo menos 10 caracteres).",
    ]);
  });

  it("recusa time grande demais e tarefa comprida demais", () => {
    const many = Array.from({ length: MAX_MEMBERS + 1 }, () => FORM.members[0]);
    expect(parseCustomRecipe({ ...FORM, members: many }).ok).toBe(false);
    const long = [{ ...FORM.members[0], instruction: "x".repeat(MAX_INSTRUCTION + 1) }, FORM.members[1]];
    expect(parseCustomRecipe({ ...FORM, members: long })).toMatchObject({ ok: false });
  });

  it("os modelos prontos de membro são válidos", () => {
    for (const member of MEMBER_TEMPLATES) {
      expect(parseCustomRecipe({ name: "Modelo", members: [member, member] }).ok).toBe(true);
    }
  });
});

describe("montar a receita (buildCustomRecipe)", () => {
  const recipe = buildCustomRecipe({ id: ID, form: FORM });

  it("passa na mesma conferência das receitas prontas", () => {
    expect(findRecipeProblems(recipe)).toEqual([]);
  });

  it("um membro por etapa, em ordem: cada um recebe o pedido e o que o anterior fez", () => {
    const steps = recipe.stages.flatMap(stageSteps);
    expect(steps.map((step) => step.id)).toEqual(["step-1", "step-2", "step-3"]);
    expect(steps[0].inputs).toEqual([{ from: "request", label: "Pedido" }]);
    expect(steps[2].inputs).toEqual([
      { from: "request", label: "Pedido" },
      { from: "step", stepId: "step-2", label: "O que Redator fez" },
    ]);
    expect(recipe.stages.every((stage) => stage.kind === "sequential")).toBe(true);
  });

  it("a IA reserva de cada membro é outra", () => {
    for (const role of recipe.roles) expect(role.backupProvider).not.toBe(role.suggestedProvider);
  });

  it("o que a pessoa escreveu vai para a IA delimitado, junto com as nossas regras", () => {
    const last = recipe.stages.flatMap(stageSteps).at(-1);
    expect(last.instruction).toContain("-----\nRevise o texto e entregue a versão final.\n-----");
    expect(last.instruction).toContain("Nunca invente dados");
    expect(last.instruction).toContain("Formato do texto");
    expect(last.format).toBe("text");
  });

  it("roda com o time escolhido e tem estimativa", () => {
    const team = Object.fromEntries(recipe.roles.map((role) => [role.id, role.suggestedProvider]));
    expect(findRunProblems({ recipe, request: "Um post sobre clareamento.", team })).toEqual([]);
    expect(stepCosts(recipe)).toHaveLength(3);
  });

  it("o dono lê no extrato e no nome do Word só textos fixos, nunca os nomes que a pessoa escreveu (F49)", async () => {
    expect(chargeDescription(recipe, "step-2")).toBe("Receita própria · Etapa 2");
    const doc = await finalDocument(recipe, "# Título\n\nTexto.");
    expect(doc?.name).toBe("Receita-propria.docx");
  });

  it("o id da tela é custom:<id do banco>, e volta", () => {
    expect(recipe.id).toBe(customRecipeId(ID));
    expect(customRecipeDbId(recipe.id)).toBe(ID);
    expect(customRecipeDbId("create-site")).toBeNull();
  });
});

describe("a receita guardada na execução", () => {
  it("é montada de novo a partir do que ficou guardado", () => {
    expect(customRecipeFromSnapshot({ id: ID, form: FORM })?.id).toBe(customRecipeId(ID));
  });

  it("guardado estragado não vira receita", () => {
    expect(customRecipeFromSnapshot(null)).toBeUndefined();
    expect(customRecipeFromSnapshot({ id: ID, form: { name: "x" } })).toBeUndefined();
  });
});
