// O servidor de verdade (Express), com pedidos de verdade pela rede local. Confere o que antes o Next.js fazia sozinho:
// as proteções e o caminho de um pedido até a rota. Sem Supabase configurado: nada aqui toca em banco.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./http/origin-check.js";
import { callSignal, runWithDeadline } from "./lib/providers/deadline.js";
import { createApp } from "./app.js";

const SAVED = {};
const NAMES = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SITE_URL", "OCK_DEMO_MODE", "NODE_ENV"];

let server;
let base;
let dist;

beforeAll(async () => {
  dist = mkdtempSync(join(tmpdir(), "multi-ia-dist-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>Tela</title>");
  await new Promise((resolve) => {
    server = createApp({ distDir: dist }).listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dist, { recursive: true, force: true });
});

beforeEach(() => {
  for (const name of NAMES) {
    SAVED[name] = process.env[name];
    if (name !== "NODE_ENV") delete process.env[name];
  }
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  for (const name of NAMES) {
    if (SAVED[name] === undefined) delete process.env[name];
    else process.env[name] = SAVED[name];
  }
});

describe("pedidos forjados (CSRF)", () => {
  it("recusa um formulário vindo de outro site", async () => {
    const response = await fetch(`${base}/api/actions/entrar/sign-in`, {
      method: "POST",
      headers: { Origin: "https://site-do-ataque.example", "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=a%40b.com&password=123",
    });
    expect(response.status).toBe(403);
  });

  it("recusa um pedido que muda algo e não diz de onde veio", async () => {
    const response = await fetch(`${base}/api/runs/abc/cancel`, { method: "POST" });
    expect(response.status).toBe(403);
  });

  it("aceita o formulário do nosso próprio endereço", async () => {
    const response = await fetch(`${base}/api/actions/entrar/sign-in`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=a%40b.com&password=senha-qualquer",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("error");
  });

  it("no site publicado, só o endereço configurado passa", () => {
    const common = { method: "POST", path: "/api/ock", host: "ock.example.com", production: true };
    expect(isAllowedOrigin({ ...common, origin: "https://ock.example.com", siteUrl: "https://ock.example.com/" })).toBe(true);
    expect(isAllowedOrigin({ ...common, origin: "https://ock.example.com" })).toBe(false);
    expect(isAllowedOrigin({ ...common, origin: "https://outro.example", siteUrl: "https://ock.example.com" })).toBe(false);
  });

  it("a rota interna não passa pelo filtro, mas sem o segredo interno é recusada", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_de_teste";
    const response = await fetch(`${base}/api/runs/abc/continue`, { method: "POST" });
    expect(response.status).toBe(401);
  });
});

describe("cabeçalhos de segurança", () => {
  it("toda resposta bloqueia molduras apontando para outro endereço (prévia do site gerado)", async () => {
    for (const path of ["/", "/api/session", "/api/nao-existe"]) {
      const response = await fetch(base + path);
      expect(response.headers.get("content-security-policy")).toBe("frame-src 'none'");
    }
  });

  it("não anuncia a tecnologia do servidor", async () => {
    const response = await fetch(`${base}/api/session`);
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("a página do convite não vaza o código pelo Referer nem para buscadores", async () => {
    const response = await fetch(`${base}/convite/codigo-secreto`);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});

describe("as telas e as rotas", () => {
  it("sem login, a sessão diz que não há ninguém", async () => {
    const response = await fetch(`${base}/api/session`);
    expect(await response.json()).toEqual({ viewer: { status: "signed-out" }, demo: false });
  });

  it("uma tela protegida manda para Entrar, sem dado nenhum", async () => {
    const response = await fetch(`${base}/api/views/dono`);
    expect(await response.json()).toEqual({ redirect: "/entrar" });
  });

  it("endereço de API que não existe é 404, não a tela", async () => {
    const response = await fetch(`${base}/api/nao-existe`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("json");
  });

  it("qualquer endereço de tela recebe o front", async () => {
    const response = await fetch(`${base}/trabalho`);
    expect(await response.text()).toContain("<title>Tela</title>");
  });

  it("/confirmar só manda para caminhos do nosso site, mesmo com Host inventado", async () => {
    const response = await fetch(`${base}/confirmar`, {
      redirect: "manual",
      headers: { "X-Forwarded-Host": "site-do-ataque.example" },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/entrar?aviso=confirme");
  });
});

describe("visão raio-x", () => {
  it("não existe fora do modo raio-x", async () => {
    expect((await fetch(`${base}/api/views/raiox`)).status).toBe(404);
  });

  it("nunca entrega as senhas de teste, nem no modo raio-x", async () => {
    process.env.OCK_DEMO_MODE = "1";
    process.env.NODE_ENV = "development";
    const response = await fetch(`${base}/api/views/raiox`);
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("Ver como Chefe");
    expect(text).not.toContain("senha");
    expect(text).not.toContain("example.com");
  });
});

describe("limite de tempo das chamadas às IAs", () => {
  it("o sinal da chamada para quando o pedido passa do teto", async () => {
    const signal = runWithDeadline(10, () => callSignal());
    await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
    expect(signal.aborted).toBe(true);
  });

  it("o cancelamento da pessoa continua parando a chamada", () => {
    const controller = new AbortController();
    const signal = callSignal(controller.signal);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});
