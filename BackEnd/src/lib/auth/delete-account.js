// "Apagar minha conta" do funcionário (F64, LGPD). SÓ do servidor, com a chave-mestra, sempre preso ao id da própria
// pessoa (que vem do login, nunca do pedido).
//
// O que some: as conversas e mensagens, os anexos (registro e conteúdo), as receitas rodadas, as pastas de entregas, os
// times "só eu" e o login. O e-mail fica livre: a pessoa pode criar uma conta nova com ele (F32).
// O que fica com a empresa: as entregas (documentos de trabalho, que o dono já vê), os times deixados para a empresa
// toda, e o extrato com o nome da pessoa (registro financeiro: o membro é desativado, nunca apagado, F23).
// O dono não apaga a própria conta por aqui: a empresa inteira depende dela.
//
// Cada passo pode ser repetido sem estrago: se algo falhar no meio, a pessoa (ainda logada) tenta de novo.

import { removeStoredFiles } from "../ock/files.js";
import { closeRunHolds } from "../runs/wallet.js";
import { supabaseAdmin } from "../runs/supabase-server.js";

/** @typedef {"deleted" | "owner" | "busy"} DeleteAccountResult */

/** Com uma receita na fila ou rodando, ou uma resposta do chat a caminho, espera terminar. */
const BUSY_RUN = ["queued", "running"];

/**
 * @param {CurrentMember} me
 * @returns {Promise<DeleteAccountResult>}
 */
export async function deleteOwnAccount(me) {
  if (me.role === "owner") return "owner";
  const db = supabaseAdmin();

  const [runs, answering] = await Promise.all([
    db.from("runs").select("id, status").eq("member_id", me.id),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("member_id", me.id).eq("status", "running"),
  ]);
  if (runs.error) throw runs.error;
  if (answering.error) throw answering.error;
  const own = runs.data ?? [];
  if (own.some((run) => BUSY_RUN.includes(run.status)) || (answering.count ?? 0) > 0) return "busy";

  // O dinheiro reservado pelas receitas pausadas volta ao saldo da empresa.
  for (const run of own) await closeRunHolds(run.id);

  // Anexos: o registro sai agora; o conteúdo, logo depois (se falhar, a limpeza periódica termina, F28).
  const uploads = await db.from("files").delete().eq("member_id", me.id).eq("kind", "upload").select("storage_path");
  if (uploads.error) throw uploads.error;

  for (const table of ["conversations", "runs", "delivery_folders"]) {
    const { error } = await db.from(table).delete().eq("member_id", me.id);
    if (error) throw error;
  }
  const teams = await db.from("custom_recipes").delete().eq("member_id", me.id).eq("visibility", "private");
  if (teams.error) throw teams.error;

  await removeStoredFiles((uploads.data ?? []).map((row) => row.storage_path));

  // O membro fica, desativado, para o extrato; o e-mail é trocado para ficar livre; o login some.
  const { data: member, error: memberError } = await db
    .from("members")
    .update({ status: "disabled", email: `removido-${me.id}@removido.invalid` })
    .eq("id", me.id)
    .select("user_id")
    .single();
  if (memberError) throw memberError;
  if (member.user_id) {
    const { error } = await db.auth.admin.deleteUser(member.user_id);
    if (error) throw error;
  }
  return "deleted";
}
