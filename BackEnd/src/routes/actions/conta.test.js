import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  viewer: null,
  userId: "u1",
  sendResult: "sent",
  verifyResult: true,
  sent: [],
  verified: [],
  marked: [],
}));

vi.mock("../../lib/auth/viewer.js", () => ({
  getViewer: async () => state.viewer,
  getUserId: async () => state.userId,
}));
vi.mock("../../lib/auth/email-check.js", async (original) => ({
  ...(await original()),
  sendEmailCode: async (email) => {
    state.sent.push(email);
    if (state.sendResult instanceof Error) throw state.sendResult;
    return state.sendResult;
  },
  verifyEmailCode: async (input) => {
    state.verified.push(input);
    return state.verifyResult;
  },
  markEmailVerified: async (memberId) => {
    state.marked.push(memberId);
  },
}));
vi.mock("../../http/navigation.js", async (original) => ({ ...(await original()), refresh: () => {} }));

import { sendEmailCodeAction, verifyEmailCodeAction } from "./conta.js";

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function member(overrides = {}) {
  return {
    status: "member",
    member: { id: "m1", email: "ana@example.com", role: "employee", emailVerified: false, ...overrides },
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.viewer = member();
});

afterEach(() => {
  Object.assign(state, { userId: "u1", sendResult: "sent", verifyResult: true, sent: [], verified: [], marked: [] });
  vi.restoreAllMocks();
});

describe("confirmar o e-mail (F32)", () => {
  it("manda o código para o e-mail do cadastro, nunca para um que veio do formulário", async () => {
    expect(await sendEmailCodeAction(undefined, form({ email: "outro@example.com" }))).toEqual({ status: "sent" });
    expect(state.sent).toEqual(["ana@example.com"]);
  });

  it("avisa quando pediu de novo cedo demais ou o e-mail não saiu", async () => {
    state.sendResult = "too-soon";
    expect((await sendEmailCodeAction(undefined, form({}))).status).toBe("error");
    state.sendResult = new Error("sem SMTP");
    expect((await sendEmailCodeAction(undefined, form({}))).status).toBe("error");
  });

  it("confere o código com o login de quem pede e marca o e-mail", async () => {
    expect(await verifyEmailCodeAction(undefined, form({ code: "123 456" }))).toEqual({ status: "verified" });
    expect(state.verified).toEqual([{ userId: "u1", email: "ana@example.com", code: "123456" }]);
    expect(state.marked).toEqual(["m1"]);
  });

  it("código no formato errado nem é conferido; código errado não marca", async () => {
    expect((await verifyEmailCodeAction(undefined, form({ code: "12a" }))).status).toBe("error");
    expect(state.verified).toEqual([]);
    state.verifyResult = false;
    expect((await verifyEmailCodeAction(undefined, form({ code: "123456" }))).status).toBe("error");
    expect(state.marked).toEqual([]);
  });

  it("quem já confirmou não manda nem confere de novo", async () => {
    state.viewer = member({ emailVerified: true });
    expect(await sendEmailCodeAction(undefined, form({}))).toEqual({ status: "verified" });
    expect(await verifyEmailCodeAction(undefined, form({ code: "123456" }))).toEqual({ status: "verified" });
    expect(state.sent).toEqual([]);
    expect(state.verified).toEqual([]);
  });
});
