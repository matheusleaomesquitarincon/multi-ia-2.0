import { describe, expect, it } from "vitest";
import { TERMS_VERSION } from "./forms.js";
import { firstName, homePathFor, parseMemberRow } from "./member.js";

const ROW = {
  id: "b0000000-0000-4000-8000-000000000001",
  company_id: "c0000000-0000-4000-8000-000000000001",
  name: "Marina Souza",
  email: "marina@example.com",
  role: "owner",
  terms_version: TERMS_VERSION,
  companies: { name: "Agência Exemplo" },
};

const MEMBER = {
  id: ROW.id,
  companyId: ROW.company_id,
  companyName: "Agência Exemplo",
  name: "Marina Souza",
  email: "marina@example.com",
  role: "owner",
  mustChangePassword: false,
  needsTerms: false,
};

describe("quem está logado", () => {
  it("lê o cadastro com a empresa junto, venha ela como objeto ou como lista de um item", () => {
    expect(parseMemberRow(ROW)).toEqual(MEMBER);
    expect(parseMemberRow({ ...ROW, companies: [{ name: "Agência Exemplo" }] })).toEqual(MEMBER);
  });

  it("pede o aceite dos termos a quem nunca aceitou ou aceitou uma versão antiga (F05)", () => {
    expect(parseMemberRow({ ...ROW, terms_version: null }).needsTerms).toBe(true);
    expect(parseMemberRow({ ...ROW, terms_version: "2000-01-01" }).needsTerms).toBe(true);
  });

  it("falha com mensagem clara se faltar algo ou o papel for desconhecido", () => {
    expect(() => parseMemberRow(null)).toThrow("formato inesperado");
    expect(() => parseMemberRow({ ...ROW, companies: null })).toThrow("incompleto");
    expect(() => parseMemberRow({ ...ROW, name: "" })).toThrow("incompleto");
    expect(() => parseMemberRow({ ...ROW, role: "admin" })).toThrow("Papel");
  });

  it("manda cada papel para a sua página", () => {
    expect(homePathFor("owner")).toBe("/dono");
    expect(homePathFor("employee")).toBe("/trabalho");
  });

  it("cumprimenta pelo primeiro nome", () => {
    expect(firstName("Marina Souza")).toBe("Marina");
    expect(firstName("  Ana  ")).toBe("Ana");
  });
});
