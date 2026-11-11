// As conversas e as mensagens da tarefa rápida (tabelas conversations e tasks). SÓ do servidor.
// Ler é com a sessão de quem está logado: o banco só devolve as conversas e mensagens da própria pessoa (nem o dono lê
// as dos funcionários, decisão do Luis de 24/10/2026). Criar a conversa também é pela sessão, e a empresa e a pessoa vêm
// sozinhas do login. As mensagens são gravadas só pelo servidor, com a chave-mestra.

import { supabaseAdmin } from "../runs/supabase-server.js";

const CONVERSATIONS = "conversations";
const TASKS = "tasks";
const ENTRIES = "wallet_entries";
const CONVERSATION_COLUMNS = "id, title, updated_at, agent_id";
const TASK_COLUMNS =
  "id, prompt, answer, status, action, chosen_provider, chosen_tier, chosen_effort, researched, ran_code, created_at";

/** Quantas mensagens de uma conversa a tela mostra (as mais recentes). */
export const CONVERSATION_PAGE_SIZE = 100;

/**
 * @typedef {{
 * id: string;
 * title: string;
 * updated_at: string;
 * agent_id: string | null;
 * }} ConversationRow
 */

function toConversation(row) {
  return { id: row.id, title: row.title, updatedAt: row.updated_at, agentId: row.agent_id ?? null };
}

/**
 * As conversas da própria pessoa, das mais recentes para as mais antigas.
 * @param {SupabaseClient} session
 * @returns {Promise<ChatConversation[]>}
 */
export async function listOwnConversations(session, limit = 50) {
  const { data, error } = await session
    .from(CONVERSATIONS)
    .select(CONVERSATION_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toConversation);
}

/**
 * Uma conversa da própria pessoa, ou null (não existe ou é de outra pessoa).
 * @param {SupabaseClient} session
 * @param {string} id
 * @returns {Promise<ChatConversation | null>}
 */
export async function loadOwnConversation(session, id) {
  const { data, error } = await session.from(CONVERSATIONS).select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toConversation(data) : null;
}

/**
 * Cria uma conversa em nome de quem está logado (a empresa e a pessoa vêm do login, não daqui). `agentId` liga a conversa
 * a um agente pronto (lib/ock/agents.js); null é um chat comum.
 * @param {SupabaseClient} session
 * @param {string} title
 * @param {string | null} [agentId]
 * @returns {Promise<ChatConversation>}
 */
export async function createOwnConversation(session, title, agentId = null) {
  const { data, error } = await session
    .from(CONVERSATIONS)
    .insert({ title, agent_id: agentId })
    .select(CONVERSATION_COLUMNS)
    .single();
  if (error) throw error;
  return toConversation(data);
}

/**
 * Sobe a conversa na lista: o banco troca a data da última mudança sozinho.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function touchConversation(id) {
  const { error } = await supabaseAdmin()
    .from(CONVERSATIONS)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Uma mensagem como fica na tabela tasks. */
/**
 * @typedef {{
 * id: string;
 * prompt: string;
 * answer: string | null;
 * status: "running" | "finished" | "failed";
 * action: ChatAction;
 * chosen_provider: ProviderId;
 * chosen_tier: ModelTier;
 * chosen_effort: Effort;
 * // Se a IA pesquisou ou rodou um programa (F53). null nas mensagens de antes desse registro.
 * researched: boolean | null;
 * ran_code: boolean | null;
 * created_at: string;
 * }} TaskRow
 */

/**
 * @typedef {{
 * id: string;
 * company_id: string;
 * member_id: string;
 * conversation_id: string;
 * prompt: string;
 * action: ChatAction;
 * // O que o Chefe recomendou e o que a pessoa escolheu. Iguais até a escolha livre (etapa 6, F03).
 * recommended_provider: ProviderId;
 * recommended_tier: ModelTier;
 * recommended_effort: Effort;
 * chosen_provider: ProviderId;
 * chosen_tier: ModelTier;
 * chosen_effort: Effort;
 * status?: TaskRow["status"];
 * answer?: string;
 * finished_at?: string;
 * }} NewTask
 */

/**
 * @param {NewTask} task
 * @returns {Promise<void>}
 */
export async function createTask(task) {
  const { error } = await supabaseAdmin().from(TASKS).insert(task);
  if (error) throw error;
}

/**
 * Fecha a mensagem com a resposta (ou, numa falha, com o aviso do que houve) e com o que a IA de fato usou (F53).
 * @param {string} id
 * @param {"finished" | "failed"} status
 * @param {string} answer
 * @param {ToolUse} used
 * @returns {Promise<void>}
 */
export async function finishTask(id, status, answer, used) {
  const { error } = await supabaseAdmin()
    .from(TASKS)
    .update({
      status,
      answer,
      researched: used.researched,
      ran_code: used.ranCode,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * As mensagens mais recentes de uma conversa da própria pessoa, em ordem (as antigas primeiro).
 * @param {SupabaseClient} session
 * @param {string} conversationId
 * @returns {Promise<TaskRow[]>}
 */
export async function loadOwnTasks(session, conversationId, limit = CONVERSATION_PAGE_SIZE) {
  const { data, error } = await session
    .from(TASKS)
    .select(TASK_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

/**
 * Quanto cada mensagem custou, em centavos, pelas linhas de gasto da própria pessoa no extrato.
 * @param {SupabaseClient} session
 * @param {readonly string[]} taskIds
 * @returns {Promise<Map<string, number>>}
 */
export async function sumOwnTaskCharges(session, taskIds) {
  const totals = new Map();
  if (taskIds.length === 0) return totals;
  const { data, error } = await session
    .from(ENTRIES)
    .select("task_id, amount_cents")
    .in("task_id", taskIds)
    .eq("kind", "charge");
  if (error) throw error;
  for (const row of data ?? []) {
    // Os gastos entram negativos no extrato.
    totals.set(row.task_id, (totals.get(row.task_id) ?? 0) - Number(row.amount_cents));
  }
  return totals;
}
