import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = { id: "user-1", user_metadata: {} };
const auth = vi.hoisted(() => ({ ok: true, calls: [] }));
const marked = vi.hoisted(() => []);

vi.mock("../../lib/auth/session.js", () => ({
  createSessionClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code) => {
        auth.calls.push({ code });
        return auth.ok ? { data: { user: USER }, error: null } : { data: { user: null }, error: { code: "bad" } };
      },
      verifyOtp: async (params) => {
        auth.calls.push(params);
        return auth.ok ? { data: { user: USER }, error: null } : { data: { user: null }, error: { code: "otp_expired" } };
      },
    },
  }),
}));
vi.mock("../../lib/auth/company-signup.js", () => ({ ensureOwnerCompany: async () => {} }));
vi.mock("../../lib/auth/password-recovery.js", () => ({
  markMustChangePassword: async (userId) => void marked.push(userId),
}));

import { GET } from "./route.js";

const call = (query) => GET(new Request(`http://app.internal/confirmar${query}`));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  auth.ok = true;
  auth.calls = [];
  marked.length = 0;
  vi.restoreAllMocks();
});

describe("GET /confirmar", () => {
  it("confirmação do cadastro: o código vira o login e vai para a página inicial, sem marcar nada", async () => {
    const response = await call("?code=abc");
    expect(response.headers.get("location")).toBe("/");
    expect(marked).toEqual([]);
  });

  it("\"Esqueci minha senha\" pelo código: marca para trocar a senha e leva à tela da senha nova (F30)", async () => {
    const response = await call("?tipo=recuperar&code=abc");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/trocar-senha?motivo=recuperar");
    expect(marked).toEqual(["user-1"]);
  });

  it("\"Esqueci minha senha\" pelo token_hash do nosso modelo de e-mail (funciona em outro navegador)", async () => {
    const response = await call("?token_hash=xyz&type=recovery");
    expect(auth.calls).toEqual([{ type: "recovery", token_hash: "xyz" }]);
    expect(response.headers.get("location")).toBe("/trocar-senha?motivo=recuperar");
    expect(marked).toEqual(["user-1"]);
  });

  it("token_hash de outro tipo não é aceito como recuperação", async () => {
    const response = await call("?token_hash=xyz&type=signup");
    expect(auth.calls).toEqual([]);
    expect(response.headers.get("location")).toBe("/entrar?aviso=confirme");
  });

  it("link de senha vencido ou já usado: volta para Entrar com o aviso certo, sem marcar ninguém", async () => {
    auth.ok = false;
    const response = await call("?tipo=recuperar&code=velho");
    expect(response.headers.get("location")).toBe("/entrar?aviso=link-senha-vencido");
    expect(marked).toEqual([]);
  });

  it("link de confirmação vencido continua com o aviso de antes", async () => {
    auth.ok = false;
    const response = await call("?code=velho&error_code=otp_expired");
    expect(response.headers.get("location")).toBe("/entrar?aviso=link-vencido");
  });
});
