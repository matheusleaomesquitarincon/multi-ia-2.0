import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ viewer: null, recorded: [], fail: false }));

vi.mock("../../lib/auth/viewer.js", () => ({ getViewer: async () => state.viewer }));
vi.mock("../../lib/auth/terms.js", () => ({
  recordTermsAcceptance: async (who) => {
    if (state.fail) throw new Error("banco fora do ar");
    state.recorded.push(who);
  },
}));

import { RedirectSignal } from "../../http/navigation.js";
import { TERMS_REQUIRED } from "../../lib/auth/forms.js";
import { acceptTermsAction } from "./aceitar-termos.js";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function member(overrides) {
  return {
    status: "member",
    member: {
      id: "m1",
      companyId: "c1",
      companyName: "Agência Exemplo",
      name: "Ana Lima",
      email: "ana@example.com",
      role: "employee",
      mustChangePassword: false,
      needsTerms: true,
      ...overrides,
    },
  };
}

async function redirectOf(promise) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.path;
    throw error;
  }
  return null;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  state.viewer = null;
  state.recorded = [];
  state.fail = false;
  vi.restoreAllMocks();
});

describe("aceitar os termos (F05)", () => {
  it("guarda o aceite da própria pessoa e leva para a página dela", async () => {
    state.viewer = member();
    expect(await redirectOf(acceptTermsAction(undefined, form({ acceptTerms: "on" })))).toBe("/trabalho");
    expect(state.recorded).toEqual([{ memberId: "m1" }]);
  });

  it("sem a caixinha marcada, não guarda nada e avisa", async () => {
    state.viewer = member();
    expect(await acceptTermsAction(undefined, form({}))).toEqual({
      status: "invalid",
      errors: { acceptTerms: TERMS_REQUIRED },
    });
    expect(state.recorded).toEqual([]);
  });

  it("quem ainda precisa criar a senha segue para lá depois de aceitar", async () => {
    state.viewer = member({ mustChangePassword: true });
    expect(await redirectOf(acceptTermsAction(undefined, form({ acceptTerms: "on" })))).toBe("/trocar-senha");
  });

  it("quem já aceitou e quem não entrou não passam por aqui", async () => {
    state.viewer = member({ needsTerms: false, role: "owner" });
    expect(await redirectOf(acceptTermsAction(undefined, form({ acceptTerms: "on" })))).toBe("/dono");
    state.viewer = { status: "signed-out" };
    expect(await redirectOf(acceptTermsAction(undefined, form({ acceptTerms: "on" })))).toBe("/entrar");
    expect(state.recorded).toEqual([]);
  });

  it("se o banco falhar, avisa sem mandar para a página", async () => {
    state.viewer = member();
    state.fail = true;
    expect(await acceptTermsAction(undefined, form({ acceptTerms: "on" }))).toMatchObject({ status: "error" });
  });
});
