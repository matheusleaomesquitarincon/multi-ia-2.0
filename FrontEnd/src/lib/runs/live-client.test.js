import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeRun } from "./live-client.js";

// O servidor de mentira: cada busca devolve a próxima resposta combinada pelo teste.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function fakeServer(replies) {
  const urls = [];
  const send = vi.fn(async (url) => {
    urls.push(String(url));
    const reply = replies.shift() ?? { status: 200, body: { status: "running", events: [], more: false } };
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
  });
  return { send: send, urls };
}

const started = { type: "step-started", stepId: "brief", provider: "claude" };
const text = { type: "step-text", stepId: "brief", text: "Plano" };
const finished = { type: "run-finished", result: "<html></html>", durationMs: 26_000 };

describe("acompanhar a execução buscando as novidades", () => {
  it("faz o replay, depois busca só o que é novo, e para quando a execução acaba", async () => {
    const { send, urls } = fakeServer([
      { status: 200, body: { status: "running", events: [{ seq: 1, event: started }], more: false } },
      { status: 200, body: { status: "running", events: [{ seq: 2, event: text }], more: false } },
      { status: 200, body: { status: "finished", events: [{ seq: 3, event: finished }], more: false } },
    ]);
    const events = [];
    const statuses = [];

    subscribeRun(
      "run-1",
      { onEvent: (e) => events.push(e), onStatus: (s) => statuses.push(s) },
      {
        fetch: send,
        intervalMs: 1000,
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual([started]);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual([started, text, finished]);
    expect(statuses).toEqual(["running", "finished"]);
    expect(urls).toEqual([
      "/api/runs/run-1/events?after=0",
      "/api/runs/run-1/events?after=1",
      "/api/runs/run-1/events?after=2",
    ]);

    // Acabou: não busca mais nada.
    await vi.advanceTimersByTimeAsync(5000);
    expect(urls).toHaveLength(3);
  });

  it("com o replay em várias partes, busca a próxima parte na hora", async () => {
    const { send, urls } = fakeServer([
      { status: 200, body: { status: "finished", events: [{ seq: 1, event: started }], more: true } },
      { status: 200, body: { status: "finished", events: [{ seq: 2, event: finished }], more: false } },
    ]);
    const events = [];

    subscribeRun("run-1", { onEvent: (e) => events.push(e) }, { fetch: send, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(events).toEqual([started, finished]);
    expect(urls).toHaveLength(2);
  });

  it("avisa quanto a execução já custou, só quando muda; pausada, continua buscando", async () => {
    const paused = { type: "run-paused", neededCents: 452 };
    const { send, urls } = fakeServer([
      { status: 200, body: { status: "running", events: [{ seq: 1, event: started }], more: false, chargedCents: 0 } },
      { status: 200, body: { status: "paused", events: [{ seq: 2, event: paused }], more: false, chargedCents: 100 } },
      { status: 200, body: { status: "paused", events: [], more: false, chargedCents: 100 } },
    ]);
    const charged = [];

    subscribeRun(
      "run-1",
      { onEvent: () => {}, onCharged: (cents) => charged.push(cents) },
      {
        fetch: send,
        intervalMs: 1000,
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(charged).toEqual([0, 100]);
    // A pausa não é o fim: a tela continua buscando, para ver o time voltar depois do "Continuar".
    expect(urls).toHaveLength(3);
  });

  it("não repete evento que já chegou", async () => {
    const { send } = fakeServer([
      { status: 200, body: { status: "running", events: [{ seq: 1, event: started }], more: false } },
      {
        status: 200,
        body: {
          status: "running",
          events: [
            { seq: 1, event: started },
            { seq: 2, event: text },
          ],
        },
      },
    ]);
    const events = [];

    subscribeRun("run-1", { onEvent: (e) => events.push(e) }, { fetch: send, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(events).toEqual([started, text]);
  });

  it("sem login (401) ou sem acesso à execução (404), avisa e para", async () => {
    for (const [status, reason] of [
      [401, "signed-out"],
      [404, "not-found"],
    ]) {
      const { send, urls } = fakeServer([{ status, body: { problems: ["x"] } }]);
      const lost = [];

      subscribeRun("run-1", { onEvent: () => {}, onLost: (r) => lost.push(r) }, { fetch: send, intervalMs: 1000 });
      await vi.advanceTimersByTimeAsync(5000);

      expect(lost).toEqual([reason]);
      expect(urls).toHaveLength(1);
    }
  });

  it("sem internet num instante, tenta de novo na próxima busca", async () => {
    let calls = 0;
    const send = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new TypeError("Failed to fetch");
      return Response.json({ status: "running", events: [{ seq: 1, event: started }], more: false });
    });
    const events = [];

    subscribeRun("run-1", { onEvent: (e) => events.push(e) }, { fetch: send, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toEqual([started]);
  });

  it("depois de parar, não chama mais ninguém", async () => {
    const { send, urls } = fakeServer([]);
    const stop = subscribeRun("run-1", { onEvent: () => {} }, { fetch: send, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(urls).toHaveLength(1);
  });
});
