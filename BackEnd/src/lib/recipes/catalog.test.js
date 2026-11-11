import { describe, expect, it } from "vitest";
import { getRecipe, listRecipeSummaries, RECIPES } from "./catalog.js";

describe("catálogo de receitas", () => {
  it("mostra as 4 receitas do MVP para PMEs: o site, a proposta e os posts prontos, o relatório em breve", () => {
    expect(listRecipeSummaries().map((recipe) => [recipe.name, recipe.available])).toEqual([
      ["Criar um site", true],
      ["Proposta comercial", true],
      ["Posts para redes sociais", true],
      ["Relatório mensal para cliente", false],
    ]);
  });

  it("o cartão de uma receita pronta mostra o time sugerido", () => {
    expect(listRecipeSummaries()[0].team).toEqual([
      { roleName: "Chefe", provider: "claude" },
      { roleName: "Pesquisador", provider: "gemini" },
      { roleName: "Front-end", provider: "gpt" },
      { roleName: "Back-end", provider: "claude" },
    ]);
    expect(listRecipeSummaries()[1].team).toEqual([
      { roleName: "Consultor", provider: "claude" },
      { roleName: "Redator", provider: "gpt" },
      { roleName: "Cliente exigente", provider: "claude" },
    ]);
    expect(listRecipeSummaries()[2].team).toEqual([
      { roleName: "Estrategista", provider: "claude" },
      { roleName: "Redator 1", provider: "gpt" },
      { roleName: "Redator 2", provider: "claude" },
      { roleName: "Editor", provider: "gpt" },
    ]);
  });

  it("não repete identificadores", () => {
    const ids = listRecipeSummaries().map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // O teto de tempo da rota interna (continue/route.js, F54) cobre o pior caminho de UMA etapa. Uma fase sequencial
  // com várias etapas, ou uma revisão com mais de uma rodada (que refaz outra fase antes), somaria várias etapas num
  // segmento só. Se uma receita precisar disso, divida o segmento antes (uma etapa por chamada).
  it("cada segmento de cada receita tem no máximo uma etapa em sequência (F54)", () => {
    for (const recipe of RECIPES) {
      for (const stage of recipe.stages) {
        if (stage.kind === "sequential") expect(stage.steps, `${recipe.id}/${stage.id}`).toHaveLength(1);
        if (stage.kind === "review") expect(stage.maxRounds, `${recipe.id}/${stage.id}`).toBe(1);
      }
    }
  });

  it("encontra receitas prontas pelo identificador e devolve nada para as outras", () => {
    expect(getRecipe("create-site")?.name).toBe("Criar um site");
    expect(getRecipe("commercial-proposal")?.name).toBe("Proposta comercial");
    expect(getRecipe("social-posts")?.name).toBe("Posts para redes sociais");
    expect(getRecipe("client-report")).toBeUndefined();
    expect(getRecipe("nao-existe")).toBeUndefined();
  });
});
