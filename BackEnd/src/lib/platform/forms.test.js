import { describe, expect, it } from "vitest";
import { parseExchangeRate, parsePlatformTopup } from "./forms.js";

const COMPANY = "c0000000-0000-4000-8000-000000000001";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("recarga pelo painel da plataforma", () => {
  it("lê a empresa, o valor em reais e a descrição", () => {
    expect(parsePlatformTopup(form({ companyId: COMPANY, amount: "1.500,50", description: "  Pix   de 18/11 " }))).toEqual({
      ok: true,
      companyId: COMPANY,
      cents: 150050,
      description: "Pix de 18/11",
    });
  });

  it("recusa empresa inválida, valor zero ou acima de R$ 100.000,00 e descrição vazia ou longa", () => {
    expect(parsePlatformTopup(form({ companyId: "x", amount: "10", description: "Pix" })).ok).toBe(false);
    expect(parsePlatformTopup(form({ companyId: COMPANY, amount: "0", description: "Pix" })).ok).toBe(false);
    expect(parsePlatformTopup(form({ companyId: COMPANY, amount: "100000,01", description: "Pix" }))).toEqual({
      ok: false,
      message: "O máximo por recarga é R$ 100.000,00.",
    });
    expect(parsePlatformTopup(form({ companyId: COMPANY, amount: "100000", description: "Pix" })).ok).toBe(true);
    expect(parsePlatformTopup(form({ companyId: COMPANY, amount: "10", description: " " })).ok).toBe(false);
    expect(parsePlatformTopup(form({ companyId: COMPANY, amount: "10", description: "a".repeat(121) })).ok).toBe(false);
  });
});

describe("câmbio pelo painel da plataforma (F17)", () => {
  it("aceita vírgula ou ponto e até 4 casas", () => {
    expect(parseExchangeRate("5,65")).toEqual({ ok: true, rate: 5.65 });
    expect(parseExchangeRate("R$ 5.6512")).toEqual({ ok: true, rate: 5.6512 });
    expect(parseExchangeRate("6")).toEqual({ ok: true, rate: 6 });
  });

  it("recusa texto, valores fora de R$ 1 a R$ 20 e casas demais", () => {
    expect(parseExchangeRate("cinco").ok).toBe(false);
    expect(parseExchangeRate("0,99").ok).toBe(false);
    expect(parseExchangeRate("20,01").ok).toBe(false);
    expect(parseExchangeRate("5,65123").ok).toBe(false);
  });
});
