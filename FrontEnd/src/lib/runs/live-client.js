// Acompanha uma execução ao vivo, do navegador. Busca as novidades no nosso servidor a cada segundo
// (GET /api/runs/<id>/events), que lê o banco com o login de quem está vendo: só a própria pessoa acompanha a sua
// execução (F27). A primeira busca é o "replay" de tudo o que já aconteceu; as seguintes trazem só o que é novo.
//
// A posição (seq) de cada evento evita repetição: um evento só chega à tela se for mais novo que o último visto.

/** Status possíveis de uma execução, como o servidor os reporta. */
/** @typedef {"queued" | "running" | "paused" | "finished" | "failed" | "cancelled"} LiveRunStatus */

/** Por que a tela parou de acompanhar sem a execução ter acabado. */
/**
 * @typedef {| "signed-out"
 * // O login mudou para outra pessoa, ou a execução não existe mais.
 * | "not-found"} LostReason
 */

/**
 * @typedef {{
 * // Um evento novo da narração, já em ordem e sem repetição.
 * onEvent: (event: PublicRunEvent) => void;
 * // O status mudou (ex.: passou a "finished" ou "failed").
 * onStatus?: (status: LiveRunStatus) => void;
 * // Quanto já foi cobrado da execução, em centavos, sempre que muda (e na primeira busca).
 * onCharged?: (chargedCents: number) => void;
 * // Não dá mais para acompanhar (ver LostReason).
 * onLost?: (reason: LostReason) => void;
 * }} SubscribeHandlers
 */

/**
 * @typedef {{
 * // Intervalo entre as buscas.
 * intervalMs?: number;
 * // Quem faz o pedido pela internet. Os testes trocam por um dublê.
 * fetch?: typeof fetch;
 * }} SubscribeOptions
 */

const TERMINAL = new Set(["finished", "failed", "cancelled"]);
const POLL_INTERVAL_MS = 1000;

/**
 * @typedef {{
 * status: LiveRunStatus;
 * events: { seq: number; event: PublicRunEvent }[];
 * more: boolean;
 * // Ausente se o servidor não mandou (resposta fora do combinado).
 * chargedCents?: number;
 * }} EventsResponse
 */

/**
 * Começa a acompanhar a execução. Devolve uma função que para o acompanhamento.
 * Chamar a função devolvida é seguro a qualquer momento e mais de uma vez.
 * @param {string} runId
 * @param {SubscribeHandlers} handlers
 * @param {SubscribeOptions} [options]
 * @returns {() => void}
 */
export function subscribeRun(runId, handlers, options = {}) {
  const send = options.fetch ?? fetch;
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  let lastSeq = 0;
  let lastStatus = null;
  let lastCharged = null;
  let stopped = false;
  let timer = null;

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function poll() {
    timer = null;
    if (stopped) return;
    let body = null;
    try {
      const response = await send(`/api/runs/${runId}/events?after=${lastSeq}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 404) {
        if (!stopped) handlers.onLost?.(response.status === 401 ? "signed-out" : "not-found");
        stop();
        return;
      }
      if (response.ok) body = parseEventsResponse(await response.json());
    } catch {
      // Sem internet agora: tenta de novo na próxima busca.
    }
    if (stopped) return;

    if (body) {
      for (const { seq, event } of body.events) {
        if (seq <= lastSeq) continue;
        lastSeq = seq;
        handlers.onEvent(event);
        if (stopped) return;
      }
      if (body.chargedCents !== undefined && body.chargedCents !== lastCharged) {
        lastCharged = body.chargedCents;
        handlers.onCharged?.(body.chargedCents);
        if (stopped) return;
      }
      if (body.status !== lastStatus) {
        lastStatus = body.status;
        handlers.onStatus?.(body.status);
      }
      // Acabou e já veio a narração inteira (o servidor grava tudo antes de marcar o fim): não há mais o que buscar.
      if (TERMINAL.has(body.status) && !body.more) {
        stop();
        return;
      }
    }
    // Com mais eventos esperando (replay comprido), busca de novo na hora.
    if (!stopped) timer = setTimeout(() => void poll(), body?.more ? 0 : intervalMs);
  }

  void poll();
  return stop;
}

function parseEventsResponse(value) {
  if (typeof value !== "object" || value === null) return null;
  const { status, events, more, chargedCents } = value;
  if (typeof status !== "string" || !Array.isArray(events)) return null;
  return {
    status: status,
    events: events,
    more: more === true,
    ...(typeof chargedCents === "number" && Number.isFinite(chargedCents) ? { chargedCents } : {}),
  };
}
