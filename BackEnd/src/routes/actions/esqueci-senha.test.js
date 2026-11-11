import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ calls: [], error: null, configured: true }));

vi.mock("../../lib/auth/session.js", () => ({
  createSessionClient: async () =>
    auth.configured
      ? {
          auth: {
            resetPasswordForEmail: async (email, options) => {
              auth.calls.push({ email, options });
              return { data: {}, error: auth.error };
            },
          },
        }
      : null,
}));
vi.mock("../../lib/auth/site-origin.js", () => ({ siteOrigin: async () => "https://ock.example.com" }));

import { requestPasswordReset } from "./esqueci-senha.js";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  auth.calls = [];
  auth.error = null;
  auth.configured = true;
  vi.restoreAllMocks();
});

describe("\"Esqueci minha senha\" (F30)", () => {
  it("manda o link para o e-mail, voltando para /confirmar como recuperação", async () => {
    const state = await requestPasswordReset(undefined, form({ email: "Ana@Example.com" }));
    expect(state).toEqual({ status: "check-email", email: "ana@example.com" });
    expect(auth.calls).toEqual([
      { email: "ana@example.com", options: { redirectTo: "https://ock.example.com/confirmar?tipo=recuperar" } },
    ]);
  });

  it("e-mail inválido não chega ao Supabase", async () => {
    const state = await requestPasswordReset(undefined, form({ email: "ana@" }));
    expect(state).toMatchObject({ status: "invalid", values: { email: "ana@" } });
    expect(auth.calls).toHaveLength(0);
  });

  it("não diz se o e-mail tem conta: outros erros respondem como se tivesse mandado", async () => {
    auth.error = { code: "user_not_found", status: 400 };
    expect(await requestPasswordReset(undefined, form({ email: "ninguem@example.com" }))).toEqual({
      status: "check-email",
      email: "ninguem@example.com",
    });
    // O registro do servidor leva só o código, nunca o e-mail.
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("ninguem@example.com");
  });

  it("só o excesso de tentativas aparece, porque aí a pessoa precisa esperar", async () => {
    auth.error = { code: "over_email_send_rate_limit", status: 429 };
    expect(await requestPasswordReset(undefined, form({ email: "ana@example.com" }))).toMatchObject({
      status: "error",
      message: expect.stringContaining("Espere um pouco"),
    });
  });

  it("sem o login configurado, avisa", async () => {
    auth.configured = false;
    expect(await requestPasswordReset(undefined, form({ email: "ana@example.com" }))).toMatchObject({
      status: "error",
    });
  });
});
