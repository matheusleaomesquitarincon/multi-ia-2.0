import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: [], result: { data: 15000, error: null }, staff: true }));

vi.mock("../../lib/platform/panel.js", async () => {
  const { notFound } = await import("../../http/navigation.js");
  return {
    requireStaffSession: async () => {
      if (!state.staff) notFound();
      return {
        rpc: async (name, args) => {
          state.calls.push({ name, args });
          return state.result;
        },
      };
    },
  };
});
vi.mock("../../http/navigation.js", async (original) => ({ ...(await original()), refresh: () => {} }));

import { NotFoundSignal } from "../../http/navigation.js";
import { currentUsdToBrl, setUsdToBrl, USD_TO_BRL } from "../../lib/ock/pricing.js";
import { platformExchangeAction, platformTopupAction } from "./plataforma.js";

const COMPANY = "c0000000-0000-4000-8000-000000000001";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  state.calls = [];
  state.result = { data: 15000, error: null };
  state.staff = true;
  setUsdToBrl(USD_TO_BRL);
  vi.restoreAllMocks();
});

describe("recarga pelo painel da plataforma", () => {
  it("manda a recarga ao banco com o login de quem pede e diz o saldo novo", async () => {
    const result = await platformTopupAction(undefined, form({ companyId: COMPANY, amount: "150", description: "Pix" }));
    expect(state.calls).toEqual([
      { name: "platform_topup", args: { p_company_id: COMPANY, p_amount_cents: 15000, p_description: "Pix" } },
    ]);
    expect(result).toEqual({ status: "done", message: "Recarga de R$ 150,00 feita. Saldo da empresa agora: R$ 150,00." });
  });

  it("formulário errado não chega ao banco", async () => {
    const result = await platformTopupAction(undefined, form({ companyId: COMPANY, amount: "abc", description: "Pix" }));
    expect(result.status).toBe("error");
    expect(state.calls).toEqual([]);
  });

  it("traduz a recusa do banco", async () => {
    state.result = { data: null, error: { message: "company_not_found" } };
    const result = await platformTopupAction(undefined, form({ companyId: COMPANY, amount: "1", description: "Pix" }));
    expect(result).toEqual({ status: "error", message: "Essa empresa não existe mais." });
  });

  it("quem não é da equipe não chega a pedir nada", async () => {
    state.staff = false;
    await expect(
      platformTopupAction(undefined, form({ companyId: COMPANY, amount: "1", description: "Pix" })),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(state.calls).toEqual([]);
  });
});

describe("câmbio pelo painel da plataforma (F17)", () => {
  it("salva no banco e este servidor já passa a cobrar no câmbio novo", async () => {
    state.result = { data: 5.65, error: null };
    const result = await platformExchangeAction(undefined, form({ rate: "5,65" }));
    expect(state.calls).toEqual([{ name: "platform_set_usd_to_brl", args: { p_usd_to_brl: 5.65 } }]);
    expect(result).toEqual({ status: "done", message: "Câmbio salvo: R$ 5,65 por dólar." });
    expect(currentUsdToBrl()).toBe(5.65);
  });

  it("se o banco recusar, o câmbio fica como estava", async () => {
    state.result = { data: null, error: { message: "invalid_rate" } };
    const result = await platformExchangeAction(undefined, form({ rate: "5,65" }));
    expect(result.status).toBe("error");
    expect(currentUsdToBrl()).toBe(USD_TO_BRL);
  });
});
