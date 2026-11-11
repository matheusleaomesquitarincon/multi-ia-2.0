// Dispara a continuação de uma execução: o servidor chama a si mesmo em /api/runs/<id>/continue,
// que roda o próximo segmento (uma fase). "Dispara e esquece": não espera a resposta, só garante que
// a chamada saiu. Assim cada segmento roda numa chamada curta e separada, sobrevivendo ao navegador sair
// e cabendo no teto de tempo de cada chamada. SÓ do servidor: usa o segredo interno, que nunca vai para o navegador.

import { INTERNAL_SECRET_HEADER, internalRunSecret } from "./internal-secret.js";

/**
 * Descobre o endereço do próprio servidor para a chamada interna. NUNCA vem do pedido recebido: os cabeçalhos de um
 * pedido (Host, X-Forwarded-Host) podem ser inventados por quem pede, e a chamada leva o segredo interno (F39).
 * Ordem: endereço configurado (INTERNAL_BASE_URL) → o próprio computador, na porta do servidor.
 * @returns {string}
 */
export function resolveSelfOrigin() {
  const base = process.env.INTERNAL_BASE_URL;
  if (base) return base.replace(/\/+$/, "");
  // `||`, como em server.js: "PORT=" vazio no .env.local vale 3001.
  return `http://127.0.0.1:${process.env.PORT || 3001}`;
}

/**
 * Chama /api/runs/<id>/continue sem esperar a resposta. Erro aqui não derruba quem chamou:
 * se a chamada se perder, a próxima busca de novidades da tela retoma a execução (lib/runs/resume.js).
 * @param {string} runId
 * @returns {void}
 */
export function triggerContinue(runId) {
  const origin = resolveSelfOrigin();
  const secret = internalRunSecret() ?? "";
  const url = `${origin}/api/runs/${runId}/continue`;

  fetch(url, {
    method: "POST",
    headers: { [INTERNAL_SECRET_HEADER]: secret },
    // Impede de reusar uma resposta antiga desta chamada interna.
    cache: "no-store",
  }).catch((error) => {
    console.error(`[runs] Não consegui disparar a continuação de ${runId}:`, error);
  });

}
