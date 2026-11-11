import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_SECRET_HEADER, internalRunSecret } from "./internal-secret.js";
import { resolveSelfOrigin, triggerContinue } from "./trigger.js";

const ENV_NAMES = ["INTERNAL_BASE_URL", "PORT"];
const saved = {};

beforeEach(() => {
  for (const name of ENV_NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  process.env.SUPABASE_SECRET_KEY = "sb_secret_de_teste";
});

afterEach(() => {
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  delete process.env.SUPABASE_SECRET_KEY;
  vi.unstubAllGlobals();
});

describe("endereço da chamada interna (F39)", () => {
  it("vem só da configuração: endereço configurado ou o próprio servidor", () => {
    expect(resolveSelfOrigin()).toBe("http://127.0.0.1:3001");
    // "PORT=" vazio, como vem no .env.example, também vale 3001 (antes ia para a porta 80).
    process.env.PORT = "";
    expect(resolveSelfOrigin()).toBe("http://127.0.0.1:3001");
    process.env.PORT = "4000";
    expect(resolveSelfOrigin()).toBe("http://127.0.0.1:4000");
    process.env.INTERNAL_BASE_URL = "http://interno.example.com/";
    expect(resolveSelfOrigin()).toBe("http://interno.example.com");
  });

  it("dispara a continuação no próprio site, com o segredo interno no cabeçalho", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    triggerContinue("run-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3001/api/runs/run-1/continue");
    expect(init.headers[INTERNAL_SECRET_HEADER]).toBe(internalRunSecret());
  });
});
