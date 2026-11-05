// Armazém LOCAL das chaves de IA, para a visão raio-x: um jeito fácil de colar as chaves pela tela, sem editar o
// .env.local na mão. Vale SÓ no modo raio-x (lib/auth/demo.js: no computador, nunca em produção). O arquivo
// .ock-local-keys.json fica na raiz do projeto e está no .gitignore — nunca vai para o Git nem para a produção, onde
// as chaves continuam vindo só do ambiente do servidor (serverKeys). Conectar uma chave aqui já liga a IA real.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDemoMode } from "../auth/demo.js";

const FILE = join(process.cwd(), ".ock-local-keys.json");
const IDS = ["claude", "gpt", "gemini"];

/** @typedef {Partial<Record<ProviderId, string>>} DemoKeyMap */

function readRaw() {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    const out = {};
    for (const id of IDS) {
      const value = typeof data[id] === "string" ? data[id].trim() : "";
      if (value) out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * As chaves coladas na tela de teste. Vazio fora do modo raio-x (em produção nem toca no disco).
 * @returns {DemoKeyMap}
 */
export function demoKeys() {
  return isDemoMode() ? readRaw() : {};
}

/**
 * Tem ao menos uma chave conectada pela tela? Falso fora do modo raio-x.
 * @returns {boolean}
 */
export function hasAnyDemoKey() {
  return Object.keys(demoKeys()).length > 0;
}

/**
 * Quais IAs estão conectadas (só presença, nunca o valor).
 * @returns {Record<ProviderId, boolean>}
 */
export function demoKeysStatus() {
  const keys = demoKeys();
  return { claude: !!keys.claude, gpt: !!keys.gpt, gemini: !!keys.gemini };
}

/**
 * Grava as chaves recebidas (junta com as já salvas; valor vazio desconecta a IA). Só no modo raio-x.
 * @param {DemoKeyMap} partial
 * @returns {void}
 */
export function writeDemoKeys(partial) {
  if (!isDemoMode()) throw new Error("A tela de chaves de teste só existe no modo raio-x.");
  const next = readRaw();
  for (const id of IDS) {
    if (!(id in partial)) continue;
    const value = (partial[id] ?? "").trim();
    if (value) next[id] = value;
    else delete next[id];
  }
  writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
}
