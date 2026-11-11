// O chat no navegador: mandar mensagens, anexar arquivos e ler as conversas, as entregas e os gastos, sempre pelas
// rotas /api/ock/*. Quem está pedindo vem do login; o id de quem abriu a página vai junto nos botões que mudam alguma
// coisa, para o servidor recusar se o login mudou em outra aba (F34).

import { PAGE_MEMBER_FIELD } from "../auth/page-member.js";
import { isReadableAttachment, MAX_ATTACHMENT_BYTES, UNREADABLE_ATTACHMENT } from "./chat.js";

export const OFFLINE_PROBLEM = "Não conseguimos falar com o servidor. Confira sua internet e tente de novo.";
export const SERVER_PROBLEM = "Algo deu errado do nosso lado. Tente de novo daqui a pouco.";

/**
 * @template T
 * @typedef {{ ok: true; data: T } | { ok: false; problem: string }} Fetched
 */

/**
 * @typedef {{
 * message: string;
 * conversationId: string | null;
 * fileIds: string[];
 * pageMemberId: string;
 * // Ao começar uma conversa nova com um agente pronto, o id dele (lib/ock/agents.js).
 * agentId?: string | null;
 * // A IA e o nível escolhidos pela pessoa (F03). Sem valor: o Chefe decide.
 * choice?: ModelChoice;
 * }} SendBody
 */

/**
 * Manda uma mensagem e espera a resposta (com as IAs de verdade, pode levar alguns minutos).
 * @param {SendBody} body
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<SendResult>>}
 */
export function sendMessage(body, send = fetch) {
  const { pageMemberId, ...rest } = body;
  return request(
    "/api/ock",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/**
 * Anexa um arquivo. Tipo que a IA não lê, ou grande demais, é recusado aqui mesmo, sem enviar.
 * @param {File} file
 * @param {string} pageMemberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<ChatFile>>}
 */
export async function uploadAttachment(file, pageMemberId, send = fetch) {
  if (!isReadableAttachment(file.name)) return { ok: false, problem: UNREADABLE_ATTACHMENT };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, problem: `O arquivo passou de ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB. Anexe um menor.` };
  }
  const form = new FormData();
  form.append(PAGE_MEMBER_FIELD, pageMemberId);
  form.append("file", file);
  const result = await request("/api/ock/files", { method: "POST", body: form }, send);
  return result.ok ? { ok: true, data: result.data.file } : result;
}

/** O que volta de um ditado: o texto, quanto custou e o gasto do mês atualizado. */
/**
 * @typedef {{
 * text: string;
 * costCents: number;
 * month: MonthSpending;
 * }} Dictation
 */

/**
 * Manda o áudio ditado para transcrever (a voz do chat).
 * @param {Blob} audio
 * @param {string} pageMemberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<Dictation>>}
 */
export function transcribeAudio(audio, pageMemberId, send = fetch) {
  const form = new FormData();
  form.append(PAGE_MEMBER_FIELD, pageMemberId);
  form.append("audio", audio, "ditado");
  return request("/api/ock/transcribe", { method: "POST", body: form }, send);
}

/**
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<ChatConversation[]>>}
 */
export async function listConversations(send = fetch) {
  const result = await request("/api/ock/conversations", {}, send);
  return result.ok ? { ok: true, data: result.data.conversations } : result;
}

/**
 * @param {string} id
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<{ conversation: ChatConversation; tasks: ChatTask[] }>>}
 */
export function loadConversation(id, send = fetch) {
  return request(`/api/ock/conversations/${encodeURIComponent(id)}`, {}, send);
}

/**
 * As entregas da pessoa e as pastas (tarefas) em que ela organiza.
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<DeliveriesData>>}
 */
export function loadDeliveries(send = fetch) {
  return request("/api/ock/deliveries", {}, send);
}

/**
 * Cria uma pasta (tarefa) para organizar as entregas.
 * @param {string} name
 * @param {string} pageMemberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<{ folder: ChatFolder }>>}
 */
export function createFolder(name, pageMemberId, send = fetch) {
  return request(
    "/api/ock/folders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/**
 * Renomeia uma pasta.
 * @param {string} id
 * @param {string} name
 * @param {string} pageMemberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<{ ok: true }>>}
 */
export function renameFolder(id, name, pageMemberId, send = fetch) {
  return request(
    "/api/ock/folders",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/**
 * Apaga uma pasta (as entregas dentro dela voltam para "sem pasta").
 * @param {string} id
 * @param {string} pageMemberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<{ ok: true }>>}
 */
export function deleteFolder(id, pageMemberId, send = fetch) {
  return request(
    "/api/ock/folders",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/**
 * Move uma entrega para uma pasta (folderId) ou para "sem pasta" (folderId null).
 * @param {string} deliveryId
 * @param {string | null} folderId
 * @param {string} pageMemberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<{ ok: true }>>}
 */
export function moveDelivery(deliveryId, folderId, pageMemberId, send = fetch) {
  return request(
    "/api/ock/deliveries",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId, folderId, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/**
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<{ month: MonthSpending; lines: StatementLine[]; more: boolean }>>}
 */
export function loadSpending(send = fetch) {
  return request("/api/ock/spending", {}, send);
}

/**
 * Para o painel do dono: o que uma pessoa da equipe fez no mês (as linhas do extrato e as entregas).
 * @param {string} memberId
 * @param {typeof fetch} [send]
 * @returns {Promise<Fetched<MemberMonthDetails>>}
 */
export function loadMemberMonth(memberId, send = fetch) {
  return request(`/api/ock/team/${encodeURIComponent(memberId)}`, {}, send);
}

/**
 * O endereço para baixar um arquivo (o servidor confere quem pede e manda para um link que só baixa).
 * @param {string} id
 * @returns {string}
 */
export function fileUrl(id) {
  return `/api/ock/files/${encodeURIComponent(id)}`;
}

async function request(url, init, send) {
  let response;
  try {
    response = await send(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false, problem: OFFLINE_PROBLEM };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A resposta não veio no formato combinado (ex.: o servidor caiu antes de responder).
  }
  if (response.ok && body !== null) return { ok: true, data: body };
  const problem = body?.problem;
  return { ok: false, problem: typeof problem === "string" && problem ? problem : SERVER_PROBLEM };
}
