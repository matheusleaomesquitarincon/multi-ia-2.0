// O resultado de uma receita vira uma entrega da pessoa (F47): quando a receita termina, o servidor guarda o arquivo na
// pasta fechada, ligado à execução. Um site vira o .html; um texto (ex.: a proposta comercial), um arquivo Word. Assim
// ele aparece na aba Entregas de quem pediu e no painel do dono, que não lê a execução (decisão 2 do Luis, 24/10/2026).
// SÓ do servidor. Como todo arquivo da pasta, ele só sai por um link que sempre baixa e nunca abre como página do nosso
// endereço (AGENTS.md, seção 6).

import { textDocument } from "../ock/document.js";
import { hasRunDelivery, storeFile } from "../ock/files.js";
import { siteFileName } from "../ock/site-file.js";
import { finalStep } from "../recipes/types.js";

/**
 * O site do resultado final, se a última etapa da receita escreve um site (formato html). Senão, null.
 * @param {Recipe} recipe
 * @param {string | null} result
 * @returns {string | null}
 */
export function finalSite(recipe, result) {
  return finalStep(recipe)?.format === "html" && result ? result : null;
}

/**
 * O resultado em texto num arquivo Word, se a última etapa da receita escreve texto. Senão (um site, ou nada), null.
 * O nome do arquivo vem da receita, nunca do pedido (F49).
 * @param {Recipe} recipe
 * @param {string | null} result
 * @returns {Promise<GeneratedDoc | null>}
 */
export async function finalDocument(recipe, result) {
  if (finalStep(recipe)?.format !== "text" || !result) return null;
  return textDocument(recipe.documentName ?? recipe.name, result);
}

/**
 * O arquivo que a execução entrega: o site ou o Word. Null quando não há resultado.
 * @param {Recipe} recipe
 * @param {string | null} result
 * @returns {Promise<GeneratedDoc | null>}
 */
export async function finalDelivery(recipe, result) {
  const site = finalSite(recipe, result);
  if (site !== null) return { name: siteFileName(site), mime: "text/html", bytes: new TextEncoder().encode(site) };
  return finalDocument(recipe, result);
}

/**
 * Guarda a entrega de quem pediu. Se a execução já guardou (o servidor caiu e retomou), não guarda de novo.
 * @param {Pick<RunRow, "id" | "company_id" | "member_id">} run
 * @param {GeneratedDoc} delivery
 * @returns {Promise<void>}
 */
export async function saveRunDelivery(run, delivery) {
  if (await hasRunDelivery(run.id)) return;
  await storeFile({
    companyId: run.company_id,
    memberId: run.member_id,
    kind: "delivery",
    name: delivery.name,
    mime: delivery.mime,
    bytes: delivery.bytes,
    runId: run.id,
  });
}
