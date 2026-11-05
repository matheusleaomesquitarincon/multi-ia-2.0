// Os arquivos de cada pessoa: os que ela anexa (upload) e os que as IAs fazem (delivery). O conteúdo fica na pasta
// fechada "files" do Storage, no caminho <empresa>/<pessoa>/..., e os dados na tabela files. SÓ do servidor.
// Ler a tabela é com a sessão de quem está logado: o banco só devolve o que a pessoa pode ver (os próprios arquivos e,
// para o dono, também as entregas da empresa). Gravar e mexer na pasta é com a chave-mestra. O arquivo só sai por um
// link de poucos minutos, que sempre baixa e nunca abre como página (AGENTS.md, seção 6).

import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "../runs/supabase-server.js";

const BUCKET = "files";
const FILES = "files";
/** Por quanto tempo vale o link de baixar. */
const DOWNLOAD_LINK_SECONDS = 300;
const COLUMNS = "id, member_id, kind, name, storage_path, mime_type, size_bytes, task_id, created_at";

/** @typedef {"upload" | "delivery"} FileKind */

/**
 * @typedef {{
 * id: string;
 * member_id: string;
 * kind: FileKind;
 * name: string;
 * storage_path: string;
 * mime_type: string | null;
 * size_bytes: number | null;
 * task_id: string | null;
 * created_at: string;
 * }} FileRow
 */

/**
 * @typedef {{
 * companyId: string;
 * memberId: string;
 * kind: FileKind;
 * name: string;
 * // O tipo do conteúdo, para o nosso uso (ex.: mostrar um gráfico). Na pasta, todo arquivo fica "só para baixar".
 * mime: string;
 * bytes: Uint8Array;
 * taskId?: string | null;
 * // A execução de receita que fez a entrega (o site da "Criar um site", F47).
 * runId?: string | null;
 * }} NewFile
 */

/**
 * Guarda um arquivo na pasta da pessoa e registra na tabela. Devolve o id e o nome.
 * @param {NewFile} file
 * @returns {Promise<ChatFile>}
 */
export async function storeFile(file) {
  const db = supabaseAdmin();
  const path = `${file.companyId}/${file.memberId}/${randomUUID()}-${storageName(file.name)}`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: "application/octet-stream", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await db
    .from(FILES)
    .insert({
      company_id: file.companyId,
      member_id: file.memberId,
      kind: file.kind,
      name: displayName(file.name),
      storage_path: path,
      mime_type: file.mime.slice(0, 255),
      size_bytes: file.bytes.byteLength,
      task_id: file.taskId ?? null,
      run_id: file.runId ?? null,
    })
    .select("id, name")
    .single();
  if (error) {
    // Sem o registro, ninguém acharia o conteúdo: ele sai da pasta.
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data;
}

/**
 * Os anexos da própria pessoa com estes ids (os que não forem dela, ou não existirem, não voltam).
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @param {readonly string[]} ids
 * @returns {Promise<FileRow[]>}
 */
export async function loadOwnUploads(session, memberId, ids) {
  if (ids.length === 0) return [];
  const { data, error } = await session
    .from(FILES)
    .select(COLUMNS)
    .in("id", ids)
    .eq("member_id", memberId)
    .eq("kind", "upload");
  if (error) throw error;
  return data ?? [];
}

/**
 * Liga os anexos à mensagem em que foram mandados, para a conversa mostrar quais eram.
 * @param {readonly string[]} ids
 * @param {string} taskId
 * @returns {Promise<void>}
 */
export async function linkUploadsToTask(ids, taskId) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin().from(FILES).update({ task_id: taskId }).in("id", ids).is("task_id", null);
  if (error) throw error;
}

/**
 * Os arquivos (anexos e entregas) da própria pessoa ligados a estas mensagens, em ordem.
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @param {readonly string[]} taskIds
 * @returns {Promise<FileRow[]>}
 */
export async function loadTaskFiles(session, memberId, taskIds) {
  if (taskIds.length === 0) return [];
  const { data, error } = await session
    .from(FILES)
    .select(COLUMNS)
    .in("task_id", taskIds)
    .eq("member_id", memberId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * As entregas da própria pessoa (o que as IAs fizeram para ela), das mais novas para as mais antigas.
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @returns {Promise<ChatDelivery[]>}
 */
export function listOwnDeliveries(session, memberId, limit = 200) {
  return listMemberDeliveries(session, memberId, { limit });
}

/**
 * As entregas de uma pessoa, das mais novas para as mais antigas, desde `since` (sem ele, todas). Pela sessão: o dono
 * enxerga as entregas da equipe; o funcionário, só as dele (as de outra pessoa não voltam).
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @param {{ since?: Date; limit?: number }} [options]
 * @returns {Promise<ChatDelivery[]>}
 */
export async function listMemberDeliveries(session, memberId, options = {}) {
  let query = session
    .from(FILES)
    .select("id, name, created_at, folder_id")
    .eq("member_id", memberId)
    .eq("kind", "delivery");
  if (options.since) query = query.gte("created_at", options.since.toISOString());
  const { data, error } = await query.order("created_at", { ascending: false }).limit(options.limit ?? 200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    folderId: row.folder_id ?? null,
  }));
}

// ===== Pastas de entregas ("tarefas"): o funcionário organiza as entregas em pastas e move uma entrega para a que
// quiser. As pastas são lidas e criadas/renomeadas/apagadas pela sessão de quem está logado (o banco só deixa mexer
// nas próprias). Mover uma entrega muda files.folder_id, o que só o servidor pode fazer (files não dá update à sessão).

const FOLDERS = "delivery_folders";

/**
 * As pastas (tarefas) da própria pessoa, das mais novas para as mais antigas.
 * @param {SupabaseClient} session
 * @param {string} memberId
 * @returns {Promise<ChatFolder[]>}
 */
export async function listFolders(session, memberId) {
  const { data, error } = await session
    .from(FOLDERS)
    .select("id, name")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria uma pasta para a pessoa. A empresa e a pessoa vêm do login (a sessão confere as regras).
 * @param {SupabaseClient} session
 * @param {{ companyId: string; memberId: string; name: string }} params
 * @returns {Promise<ChatFolder>}
 */
export async function createFolder(session, params) {
  const { data, error } = await session
    .from(FOLDERS)
    .insert({ company_id: params.companyId, member_id: params.memberId, name: params.name })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Renomeia uma pasta da pessoa. Devolve false se a pasta não é dela (ou não existe).
 * @param {SupabaseClient} session
 * @param {string} id
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function renameFolder(session, id, name) {
  const { data, error } = await session.from(FOLDERS).update({ name }).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Apaga uma pasta da pessoa. As entregas dentro dela voltam para "sem pasta" (FK on delete set null).
 * @param {SupabaseClient} session
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteFolder(session, id) {
  const { data, error } = await session.from(FOLDERS).delete().eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Move uma entrega da pessoa para uma pasta dela (ou para "sem pasta", folderId null).
 * @param {SupabaseClient} session
 * @param {{ memberId: string; deliveryId: string; folderId: string | null }} params
 * @returns {Promise<boolean>}
 */
export async function moveDelivery(session, params) {
  const { memberId, deliveryId, folderId } = params;
  if (folderId !== null) {
    // A pasta de destino tem de ser da própria pessoa.
    const { data: folder, error: folderError } = await session
      .from(FOLDERS)
      .select("id")
      .eq("id", folderId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (folderError) throw folderError;
    if (!folder) return false;
  }
  // files não dá update à sessão: a mudança é pela chave-mestra, presa à própria entrega da pessoa.
  const { data, error } = await supabaseAdmin()
    .from(FILES)
    .update({ folder_id: folderId })
    .eq("id", deliveryId)
    .eq("member_id", memberId)
    .eq("kind", "delivery")
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Se a execução de receita já guardou a entrega dela (para não guardar o mesmo site duas vezes).
 * @param {string} runId
 * @returns {Promise<boolean>}
 */
export async function hasRunDelivery(runId) {
  const { data, error } = await supabaseAdmin()
    .from(FILES)
    .select("id")
    .eq("run_id", runId)
    .eq("kind", "delivery")
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Um arquivo que a pessoa pode ver (os dela e, para o dono, as entregas da empresa), ou null.
 * @param {SupabaseClient} session
 * @param {string} id
 * @returns {Promise<FileRow | null>}
 */
export async function loadVisibleFile(session, id) {
  const { data, error } = await session.from(FILES).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * O conteúdo de um arquivo da pasta. Só depois de conferir, pela sessão, que a pessoa pode vê-lo.
 * @param {string} path
 * @returns {Promise<Uint8Array>}
 */
export async function readStoredFile(path) {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Um link de poucos minutos que baixa o arquivo com o nome dele. Só depois de conferir, pela sessão, quem pede.
 * @param {Pick<FileRow, "storage_path" | "name">} file
 * @returns {Promise<string>}
 */
export async function downloadLink(file) {
  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(file.storage_path, DOWNLOAD_LINK_SECONDS, { download: file.name });
  if (error) throw error;
  return data.signedUrl;
}

/**
 * O nome mostrado na tela e usado ao baixar: sem caminho de pasta, com até 255 caracteres.
 * @param {string} name
 * @returns {string}
 */
export function displayName(name) {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "";
  return (base || "arquivo").slice(0, 255);
}

/** O nome no caminho da pasta: só letras sem acento, números e . _ - */
function storageName(name) {
  return (
    displayName(name)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80) || "arquivo"
  );
}
