// O código do convite: o que vai no link que o dono manda ao funcionário. No banco fica só o resumo dele (sha256),
// então quem ler a tabela member_invites não consegue montar o link. SÓ do servidor (usa o node:crypto).

import { createHash, randomBytes } from "node:crypto";

/** O link vale 24 horas (decisão do Luis, 24/10/2026). */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/** "invite": a pessoa ainda não criou a senha. "reset": já criou e precisa de uma senha nova. */
/** @typedef {"invite" | "reset"} InviteKind */

// 32 bytes aleatórios em base64url dão 43 letras, números, "-" e "_": impossível de adivinhar.
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * @returns {string}
 */
export function newInviteToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Confere o formato antes de ir ao banco: link cortado ou inventado nem chega a ser procurado.
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeInviteToken(value) {
  return TOKEN_PATTERN.test(value);
}

/**
 * @param {string} token
 * @returns {string}
 */
export function hashInviteToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * O endereço do convite dentro do nosso site.
 * @param {string} token
 * @returns {string}
 */
export function invitePath(token) {
  return `/convite/${token}`;
}
