// Algumas regras simples (limites, preços, formatação) rodam dos dois lados. Como cada parte do projeto fica na sua pasta,
// elas existem em duas cópias: em BackEnd/src/lib e aqui. Este teste garante que as cópias nunca fiquem diferentes.
// Mudou um desses arquivos? Mude nos dois lugares.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const LIB = dirname(fileURLToPath(import.meta.url));
const BACK_LIB = join(LIB, "..", "..", "..", "BackEnd", "src", "lib");

/** O que só existe no navegador, sem cópia no servidor. */
const FRONT_ONLY = new Set([
  "api.js",
  "actions.js",
  "session.jsx",
  "useView.js",
  "copies.test.js",
  "ock/chat-client.js",
  "ock/chat-client.test.js",
  "runs/client.js",
  "runs/active-run.js",
  "runs/live-client.js",
  "runs/live-client.test.js",
]);

/** O que nunca pode ir para o navegador: login, chaves, instruções das IAs e contas de teste. */
const SERVER_ONLY = [
  "auth/config.js",
  "auth/demo.js",
  "auth/session.js",
  "auth/viewer.js",
  "auth/invites.js",
  "keys/server-keys.js",
  "keys/demo-keys.js",
  "runs/supabase-server.js",
  "runs/internal-secret.js",
  "providers/real.js",
  "providers/registry.js",
  "recipes/catalog.js",
];

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const files = listFiles(LIB).map((path) => relative(LIB, path).split("\\").join("/"));

describe("as regras que rodam dos dois lados", () => {
  const copies = files.filter((file) => !FRONT_ONLY.has(file));

  it("há cópias para conferir", () => {
    expect(copies.length).toBeGreaterThan(0);
  });

  it.each(copies)("%s é idêntico ao do BackEnd", (file) => {
    const front = readFileSync(join(LIB, file), "utf8");
    const back = readFileSync(join(BACK_LIB, file), "utf8");
    expect(front).toBe(back);
  });
});

describe("o que nunca vai para o navegador", () => {
  it.each(SERVER_ONLY)("%s não existe no FrontEnd", (file) => {
    expect(files).not.toContain(file);
  });

  it("nenhum arquivo do FrontEnd lê variáveis de ambiente do servidor", () => {
    const source = listFiles(join(LIB, ".."))
      .filter((path) => /\.jsx?$/.test(path) && !path.endsWith(".test.js"))
      .map((path) => [path, readFileSync(path, "utf8")]);
    const found = source.filter(([, text]) => /process\.env|SUPABASE_SECRET|OCK_[A-Z]+_KEY/.test(text)).map(([path]) => path);
    expect(found).toEqual([]);
  });
});
