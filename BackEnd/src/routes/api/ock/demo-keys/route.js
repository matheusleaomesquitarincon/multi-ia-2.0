// Tela de chaves de teste (visão raio-x): grava as chaves da plataforma num arquivo local (fora do Git) para usar a IA
// de verdade no computador, sem editar o .env.local. Só existe no modo raio-x; em produção dá 404. O valor da chave
// nunca volta para a tela (o GET só diz quais estão conectadas).

import { isDemoMode } from "../../../../lib/auth/demo.js";
import { writeDemoKeys } from "../../../../lib/keys/demo-keys.js";
import { serverKeys } from "../../../../lib/keys/server-keys.js";

const IDS = ["claude", "gpt", "gemini"];

/** Quais IAs estão de fato disponíveis (ambiente + chaves coladas na tela), só presença, nunca o valor. */
function connectedStatus() {
  const keys = serverKeys();
  return { claude: !!keys.claude, gpt: !!keys.gpt, gemini: !!keys.gemini };
}

/**
 * @returns {Promise<Response>}
 */
export async function GET() {
  if (!isDemoMode()) return Response.json({ error: "Só no modo raio-x." }, { status: 404 });
  return Response.json({ connected: connectedStatus() });
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  if (!isDemoMode()) return Response.json({ error: "Só no modo raio-x." }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const source = body ?? {};
  const partial = {};
  for (const id of IDS) {
    if (typeof source[id] === "string") partial[id] = source[id];
  }

  try {
    writeDemoKeys(partial);
  } catch {
    return Response.json({ error: "Não deu para salvar." }, { status: 500 });
  }
  return Response.json({ connected: connectedStatus() });
}
