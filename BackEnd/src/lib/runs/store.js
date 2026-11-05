// Acesso tipado às tabelas da execução persistida (runs, run_events e ai_calls, que o chat também usa). SÓ do servidor.
// Duas portas, como no resto do banco novo:
//  - as funções que recebem `session` leem com a sessão de quem está logado: o banco só devolve as execuções da
//    própria pessoa, e só as colunas que ela pode ver. É assim que as rotas que o navegador chama leem;
//  - as outras usam a chave secreta (supabaseAdmin), porque só o servidor grava execuções e as leva adiante.
// O resto do servidor fala com essas tabelas só por aqui.

import { supabaseAdmin } from "./supabase-server.js";

const RUNS = "runs";
const RUN_EVENTS = "run_events";
const AI_CALLS = "ai_calls";

/**
 * Por quanto tempo uma execução fica reservada para quem a está rodando. Quem roda renova a reserva a cada poucos
 * segundos (heartbeat); se o servidor cair, ela vence logo e a execução pode ser retomada.
 */
export const LEASE_MS = 60 * 1000;

/**
 * Como uma execução pode estar no banco. `paused`: o custo ia passar do que foi reservado, e a execução espera a pessoa
 * dizer se continua (reservando mais) ou para.
 */
/** @typedef {"queued" | "running" | "paused" | "finished" | "failed" | "cancelled"} RunStatus */

/** Os status em que a execução já acabou e nada mais muda. */
export const FINAL_STATUSES = ["finished", "failed", "cancelled"];

/** O erro guardado quando uma execução falha (coluna interna; a tela nunca a lê). */
/**
 * @typedef {{
 * stepId: string;
 * provider: ProviderId;
 * retryable: boolean;
 * errorMessage: string;
 * }} RunError
 */

/** Uma linha da tabela `runs`, como o servidor a vê (com as colunas internas). */
/**
 * @typedef {{
 * id: string;
 * company_id: string;
 * member_id: string;
 * recipe_id: string;
 * request: string;
 * team: Record<string, ProviderId>;
 * plan: PublicPlannedStage[];
 * status: RunStatus;
 * cursor: RunCursor;
 * outputs: Record<string, string>;
 * results: StepResult[];
 * result: string | null;
 * duration_ms: number | null;
 * error: RunError | null;
 * lease_until: string | null;
 * attempt: number;
 * created_at: string;
 * updated_at: string;
 * finished_at: string | null;
 * }} RunRow
 */

/**
 * O que é preciso para criar uma execução. O id vem pronto, porque a reserva na carteira é feita antes, já com ele;
 * os contadores e as datas o banco preenche.
 */
/**
 * @typedef {{
 * id: string;
 * company_id: string;
 * member_id: string;
 * recipe_id: string;
 * request: string;
 * team: Record<string, ProviderId>;
 * plan: PublicPlannedStage[];
 * // A estimativa reservada ao começar: o máximo que o time pode gastar, em centavos.
 * estimate_cents: number;
 * }} NewRun
 */

/** O que a própria pessoa vê da execução dela (as colunas que a sessão pode ler). */
/**
 * @typedef {{
 * id: string;
 * recipe_id: string;
 * // O pedido, escrito pela própria pessoa.
 * request: string;
 * status: RunStatus;
 * plan: PublicPlannedStage[];
 * cursor: RunCursor;
 * result: string | null;
 * duration_ms: number | null;
 * estimate_cents: number | null;
 * }} OwnRun
 */

const OWN_RUN_COLUMNS = "id, recipe_id, request, status, plan, cursor, result, duration_ms, estimate_cents";

/**
 * Uma chamada a uma IA, para a tabela interna `ai_calls`, inclusive as tentativas que falharam e a que parou no meio:
 * a plataforma paga e não cobra (F26). Modelo, tokens e custo em dólar nunca vão para a tela.
 */
/**
 * @typedef {{
 * company_id: string;
 * member_id: string;
 * // De qual execução de receita, ou de qual tarefa do chat, veio a chamada.
 * run_id: string | null;
 * task_id?: string | null;
 * // A etapa da receita, ou "chief" e "answer" no chat (o Chefe decidindo e a IA respondendo).
 * step_id: string;
 * // Número da tentativa com esta IA nesta etapa (1 é a primeira).
 * attempt: number;
 * provider: ProviderId;
 * model: string;
 * tier: ModelTier;
 * input_tokens: number;
 * output_tokens: number;
 * // O que a empresa da IA cobra da OCK, em dólar, e o câmbio usado para cobrar em reais.
 * cost_usd: number;
 * usd_brl: number;
 * // true quando a chamada virou linha de gasto no extrato da empresa.
 * charged: boolean;
 * status: "ok" | "error";
 * error_message: string | null;
 * duration_ms: number;
 * }} AiCallRow
 */

/** Os campos do estado de uma execução que o motor atualiza a cada segmento. */
/**
 * @typedef {{
 * outputs?: Record<string, string>;
 * results?: StepResult[];
 * team?: Record<string, ProviderId>;
 * cursor?: RunCursor;
 * status?: RunStatus;
 * result?: string | null;
 * duration_ms?: number | null;
 * finished_at?: string | null;
 * lease_until?: string | null;
 * }} SnapshotPatch
 */

/** Um evento guardado, com a sua posição (seq) na ordem em que entrou. */
/**
 * @typedef {{
 * seq: number;
 * event: PublicRunEvent;
 * }} StoredEvent
 */

/**
 * Cria a execução na fila (status 'queued', cursor na 1ª fase), com o id que veio pronto, e devolve o id.
 * @param {NewRun} run
 * @returns {Promise<string>}
 */
export async function createRun(run) {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .insert({
      ...run,
      status: "queued",
      cursor: { stageIndex: 0, round: 1 },
      outputs: {},
      results: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Reivindica a execução para rodar AGORA, de forma atômica: só sai de 'queued'/'running' se ninguém mais
 * estiver rodando (sem reserva ou com a reserva vencida). Marca 'running', reserva por LEASE_MS
 * e soma 1 em `attempt`. A troca condicional em `attempt` garante que, de dois servidores concorrentes,
 * só um reivindica. Devolve a linha reivindicada, ou null se não dava para reivindicar.
 * @param {string} id
 * @returns {Promise<RunRow | null>}
 */
export async function claimRun(id) {
  const db = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();

  // Lê o `attempt` atual para a troca condicional (compare-and-swap) logo abaixo.
  const { data: current, error: readError } = await db.from(RUNS).select("attempt").eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (!current) return null;

  const attempt = current.attempt ?? 0;
  const { data, error } = await db
    .from(RUNS)
    .update({ status: "running", lease_until: leaseUntil, attempt: attempt + 1 })
    .eq("id", id)
    .eq("attempt", attempt)
    .in("status", ["queued", "running"])
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Renova a reserva de quem está rodando e devolve o status atual da execução (para perceber um cancelamento no meio
 * da fase). Devolve null se a execução foi reivindicada por outro (o `attempt` mudou): aí quem chamou deve parar.
 * @param {string} id
 * @param {number} attempt
 * @returns {Promise<RunStatus | null>}
 */
export async function renewLease(id, attempt) {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ lease_until: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", id)
    .eq("attempt", attempt)
    .select("status")
    .maybeSingle();
  if (error) throw error;
  return data?.status ?? null;
}

/**
 * Anexa, em ordem, eventos públicos à narração da execução.
 * @param {Pick<RunRow, "id" | "company_id">} run
 * @param {PublicRunEvent[]} events
 * @returns {Promise<void>}
 */
export async function appendEvents(run, events) {
  if (events.length === 0) return;
  const rows = events.map((event) => ({ run_id: run.id, company_id: run.company_id, event }));
  const { error } = await supabaseAdmin().from(RUN_EVENTS).insert(rows);
  if (error) throw error;
}

/**
 * Registra chamadas às IAs na tabela interna (modelo exato, tokens, tempo).
 * @param {AiCallRow[]} rows
 * @returns {Promise<void>}
 */
export async function recordAiCalls(rows) {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin().from(AI_CALLS).insert(rows);
  if (error) throw error;
}

/**
 * Salva o estado da execução depois de um segmento (saídas, etapas, cursor...), só se ela ainda é de quem a rodou
 * (`attempt` igual ao da reivindicação). Devolve false se outro servidor a assumiu: aí nada é gravado nem cobrado.
 * @param {string} runId
 * @param {number} attempt
 * @param {SnapshotPatch} patch
 * @returns {Promise<boolean>}
 */
export async function saveSnapshot(runId, attempt, patch) {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update(patch)
    .eq("id", runId)
    .eq("attempt", attempt)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Solta a execução que acabou de rodar uma fase: volta para a fila ('queued', para a próxima fase) ou fica pausada
 * ('paused', esperando a pessoa). Só se ela ainda está rodando com esta reivindicação; devolve false se não (a pessoa
 * cancelou no meio, ou outro servidor a assumiu).
 * @param {string} id
 * @param {number} attempt
 * @param {"queued" | "paused"} status
 * @returns {Promise<boolean>}
 */
export async function releaseRun(id, attempt, status) {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ status, lease_until: null })
    .eq("id", id)
    .eq("attempt", attempt)
    .eq("status", "running")
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Por quanto tempo quem apertou "Continuar" segura a execução pausada enquanto reserva o que falta. */
const RESUME_LOCK_MS = 30 * 1000;

/**
 * Segura a execução pausada para quem vai retomá-la, usando a mesma coluna da reserva de quem roda (lease_until). Dois
 * cliques em "Continuar" ao mesmo tempo não reservam duas vezes: só um segura. Devolve a linha, ou null se ela não está
 * pausada ou se outro pedido já a segura.
 * @param {string} id
 * @returns {Promise<RunRow | null>}
 */
export async function lockPausedRun(id) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ lease_until: new Date(Date.now() + RESUME_LOCK_MS).toISOString() })
    .eq("id", id)
    .eq("status", "paused")
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Solta a execução pausada sem retomá-la (a reserva do que falta foi recusada): ela continua esperando a pessoa.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function unlockPausedRun(id) {
  const { error } = await supabaseAdmin().from(RUNS).update({ lease_until: null }).eq("id", id).eq("status", "paused");
  if (error) throw error;
}

/**
 * Volta a execução pausada para a fila. Devolve false se ela não estava mais pausada (ex.: a pessoa cancelou).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function requeuePausedRun(id) {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ status: "queued", lease_until: null })
    .eq("id", id)
    .eq("status", "paused")
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Carrega a linha inteira de uma execução, ou null se ela não existe.
 * @param {string} id
 * @returns {Promise<RunRow | null>}
 */
export async function loadRun(id) {
  const { data, error } = await supabaseAdmin().from(RUNS).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Muda o status de uma execução, opcionalmente com outros campos (resultado, tempo, erro, reserva...).
 * @param {string} id
 * @param {RunStatus} status
 * @param {SnapshotPatch & { error?: RunError | null }} [extra]
 * @returns {Promise<void>}
 */
export async function setStatus(id, status, extra = {}) {
  const { error } = await supabaseAdmin()
    .from(RUNS)
    .update({ status, ...extra })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Marca a execução como cancelada, só se ela ainda não tinha acabado. Devolve null se ela já tinha acabado; senão,
 * até quando vale a reserva de quem a está rodando (lease_until; null se ninguém roda).
 * Quem estiver rodando percebe na próxima renovação da reserva e para a IA no meio.
 * @param {string} id
 * @returns {Promise<{ leaseUntil: string | null } | null>}
 */
export async function cancelRun(id) {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["queued", "running", "paused"])
    .select("lease_until");
  if (error) throw error;
  const [row] = data ?? [];
  return row ? { leaseUntil: row.lease_until } : null;
}

/**
 * A execução da própria pessoa, lida com a sessão dela. Execução de outra pessoa (ou que não existe) volta null.
 * @param {SupabaseClient} session
 * @param {string} id
 * @returns {Promise<OwnRun | null>}
 */
export async function loadOwnRun(session, id) {
  const { data, error } = await session.from(RUNS).select(OWN_RUN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Quantos eventos vão, no máximo, em cada busca. O banco devolve no máximo 1.000 linhas por consulta. */
export const EVENTS_PAGE_SIZE = 500;

/**
 * Os eventos com posição (seq) maior que `afterSeq`, em ordem, lidos com a sessão de quem está logado, no máximo
 * EVENTS_PAGE_SIZE de cada vez. Base do replay (do início, com 0) e das buscas de novidades da tela.
 * @param {SupabaseClient} session
 * @param {string} id
 * @param {number} afterSeq
 * @returns {Promise<StoredEvent[]>}
 */
export async function loadOwnEventsAfter(session, id, afterSeq) {
  const { data, error } = await session
    .from(RUN_EVENTS)
    .select("id, event")
    .eq("run_id", id)
    .gt("id", afterSeq)
    .order("id", { ascending: true })
    .limit(EVENTS_PAGE_SIZE);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    seq: row.id,
    event: row.event,
  }));
}
