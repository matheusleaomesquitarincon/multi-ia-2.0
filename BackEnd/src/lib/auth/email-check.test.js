import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supa = vi.hoisted(() => ({ verify: null, signOuts: 0, otp: { error: null } }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: async () => supa.otp,
      verifyOtp: async () => supa.verify,
      signOut: async () => {
        supa.signOuts += 1;
        return { error: null };
      },
    },
  }),
}));

import { sendEmailCode, verifyEmailCode } from "./email-check.js";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
});

afterEach(() => {
  vi.unstubAllEnvs();
  Object.assign(supa, { verify: null, signOuts: 0, otp: { error: null } });
});

describe("código de confirmação do e-mail (F32)", () => {
  it("só vale para o mesmo login que pediu, e a sessão do código é encerrada", async () => {
    supa.verify = { data: { user: { id: "u1" } }, error: null };
    expect(await verifyEmailCode({ userId: "u1", email: "a@example.com", code: "123456" })).toBe(true);
    expect(await verifyEmailCode({ userId: "outro", email: "a@example.com", code: "123456" })).toBe(false);
    expect(supa.signOuts).toBe(2);
  });

  it("código errado ou fora do formato não confirma", async () => {
    supa.verify = { data: { user: null }, error: { code: "otp_expired" } };
    expect(await verifyEmailCode({ userId: "u1", email: "a@example.com", code: "123456" })).toBe(false);
    expect(await verifyEmailCode({ userId: "u1", email: "a@example.com", code: "abc" })).toBe(false);
  });

  it("pedido repetido cedo demais vira 'too-soon'", async () => {
    supa.otp = { error: { code: "over_email_send_rate_limit", status: 429 } };
    expect(await sendEmailCode("a@example.com")).toBe("too-soon");
    supa.otp = { error: null };
    expect(await sendEmailCode("a@example.com")).toBe("sent");
  });
});
