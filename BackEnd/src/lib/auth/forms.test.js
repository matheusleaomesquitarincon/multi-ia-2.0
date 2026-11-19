import { describe, expect, it } from "vitest";
import { acceptedTerms, parseForgotPassword, parseNewPassword, parseSignIn, parseSignUp, TERMS_REQUIRED } from "./forms.js";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** O formulário do cadastro com a caixinha dos termos marcada, como o navegador manda. */
function signUp(fields) {
  return form({ acceptTerms: "on", ...fields });
}

const VALID = {
  companyName: "Agência Exemplo",
  ownerName: "Marina Souza",
  email: "marina@example.com",
  password: "senha-boa-123",
};

describe("conferência do cadastro da empresa", () => {
  it("aceita um cadastro completo", () => {
    expect(parseSignUp(signUp(VALID))).toEqual({ ok: true, values: VALID });
  });

  it("arruma espaços nos nomes e deixa o e-mail em minúsculas, mas não mexe na senha", () => {
    const result = parseSignUp(
      signUp({
        companyName: "  Agência   Exemplo ",
        ownerName: " Marina\tSouza ",
        email: "  Marina@Example.COM ",
        password: " com espaço ",
      }),
    );
    expect(result).toEqual({
      ok: true,
      values: {
        companyName: "Agência Exemplo",
        ownerName: "Marina Souza",
        email: "marina@example.com",
        password: " com espaço ",
      },
    });
  });

  it("aponta cada campo com problema e devolve o que foi digitado, sem a senha", () => {
    const result = parseSignUp(signUp({ companyName: " ", ownerName: "", email: "marina@", password: "curta" }));
    expect(result).toEqual({
      ok: false,
      errors: {
        companyName: "Preencha o nome da empresa.",
        ownerName: "Preencha o seu nome.",
        email: "Confira o e-mail: ele parece incompleto.",
        password: "A senha precisa de pelo menos 8 caracteres.",
      },
      values: { companyName: "", ownerName: "", email: "marina@" },
    });
  });

  it("trata campo que nem veio como campo vazio", () => {
    const result = parseSignUp(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(Object.keys(result.errors).sort()).toEqual(["acceptTerms", "companyName", "email", "ownerName", "password"]);
  });

  it("recusa nomes acima do limite do banco (120 caracteres)", () => {
    const result = parseSignUp(signUp({ ...VALID, companyName: "a".repeat(121) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual({ companyName: "Use até 120 caracteres." });
    expect(parseSignUp(signUp({ ...VALID, companyName: "a".repeat(120) })).ok).toBe(true);
  });

  it("recusa senha acima de 72 bytes, que o Supabase cortaria sem avisar", () => {
    // "ç" ocupa 2 bytes: 37 dele dão 74 bytes em só 37 caracteres.
    const result = parseSignUp(signUp({ ...VALID, password: "ç".repeat(37) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual({ password: "A senha é longa demais." });
    expect(parseSignUp(signUp({ ...VALID, password: "a".repeat(72) })).ok).toBe(true);
  });

  it("recusa o cadastro sem a caixinha dos termos marcada (F05)", () => {
    expect(parseSignUp(form(VALID))).toEqual({
      ok: false,
      errors: { acceptTerms: TERMS_REQUIRED },
      values: { companyName: VALID.companyName, ownerName: VALID.ownerName, email: VALID.email },
    });
    expect(parseSignUp(form({ ...VALID, acceptTerms: "sim" })).ok).toBe(false);
  });
});

describe("caixinha dos termos", () => {
  it("só vale marcada, do jeito que o navegador manda", () => {
    expect(acceptedTerms(form({ acceptTerms: "on" }))).toBe(true);
    expect(acceptedTerms(form({ acceptTerms: "" }))).toBe(false);
    expect(acceptedTerms(new FormData())).toBe(false);
  });
});

describe("conferência da entrada", () => {
  it("aceita e-mail e senha, com o e-mail em minúsculas", () => {
    expect(parseSignIn(form({ email: " Ana@Example.com", password: "x" }))).toEqual({
      ok: true,
      values: { email: "ana@example.com", password: "x" },
    });
  });

  it("pede o que faltou e devolve o e-mail digitado", () => {
    expect(parseSignIn(form({ email: "ana@example.com", password: "" }))).toEqual({
      ok: false,
      errors: { password: "Preencha a senha." },
      values: { email: "ana@example.com" },
    });
    expect(parseSignIn(new FormData())).toEqual({
      ok: false,
      errors: { email: "Preencha o e-mail.", password: "Preencha a senha." },
      values: { email: "" },
    });
  });
});

describe("conferência da senha criada no convite", () => {
  it("aceita a senha repetida igual, sem mexer em espaços", () => {
    expect(parseNewPassword(form({ password: " senha boa ", confirm: " senha boa " }))).toEqual({
      ok: true,
      values: { password: " senha boa ", confirm: " senha boa " },
    });
  });

  it("pede pelo menos 8 caracteres e no máximo 72 bytes", () => {
    expect(parseNewPassword(form({ password: "curta", confirm: "curta" }))).toEqual({
      ok: false,
      errors: { password: "A senha precisa de pelo menos 8 caracteres." },
      values: {},
    });
    const long = "ç".repeat(37);
    expect(parseNewPassword(form({ password: long, confirm: long }))).toEqual({
      ok: false,
      errors: { password: "A senha é longa demais." },
      values: {},
    });
  });

  it("avisa quando a repetição não bate, e nunca devolve a senha", () => {
    expect(parseNewPassword(form({ password: "senha-boa-123", confirm: "senha-boa-12" }))).toEqual({
      ok: false,
      errors: { confirm: "As duas senhas não são iguais. Digite de novo." },
      values: {},
    });
    expect(parseNewPassword(new FormData()).ok).toBe(false);
  });
});

describe("conferência do \"Esqueci minha senha\" (F30)", () => {
  it("aceita um e-mail, já sem espaços e em minúsculas", () => {
    expect(parseForgotPassword(form({ email: " Ana@Example.com " }))).toEqual({
      ok: true,
      values: { email: "ana@example.com" },
    });
  });

  it("recusa vazio e e-mail incompleto, devolvendo o que foi digitado", () => {
    expect(parseForgotPassword(form({}))).toMatchObject({ ok: false, errors: { email: "Preencha o e-mail." } });
    expect(parseForgotPassword(form({ email: "ana@" }))).toEqual({
      ok: false,
      errors: { email: "Confira o e-mail: ele parece incompleto." },
      values: { email: "ana@" },
    });
  });
});
