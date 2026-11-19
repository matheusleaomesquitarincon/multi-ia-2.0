// O painel interno da plataforma (bloco 3), visto do servidor: quem é da equipe e o que o painel mostra. Tudo passa pelo
// login de quem pede (a sessão): quem confere a equipe é o banco, dentro de cada função platform_* (migração
// 20261118130000_platform_panel.sql). Quem não é da equipe recebe "não encontrado", sem saber que o painel existe.

import { notFound, redirect } from "../../http/navigation.js";
import { signedInSession } from "../auth/session.js";

/**
 * Se quem está logado é da equipe da plataforma. Sem login, ou se o banco falhar: não é.
 * @returns {Promise<boolean>}
 */
export async function isPlatformStaff() {
  try {
    const session = await signedInSession();
    if (!session) return false;
    const { data, error } = await session.rpc("platform_is_staff");
    if (error) throw new Error(error.message);
    return data === true;
  } catch (error) {
    console.error("[plataforma] Não deu para conferir a equipe:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Para as rotas do painel: devolve a sessão de quem é da equipe; sem login, manda entrar; fora da equipe, não encontrado.
 * @returns {Promise<SupabaseClient>}
 */
export async function requireStaffSession() {
  const session = await signedInSession();
  if (!session) redirect("/entrar");
  const { data, error } = await session.rpc("platform_is_staff");
  if (error) throw new Error(`Não deu para conferir a equipe: ${error.message}`);
  if (data !== true) notFound();
  return session;
}

/**
 * Começo do mês no horário de Brasília (UTC-3, sem horário de verão desde 2019), como o banco conta o mês.
 * @param {Date} now
 * @returns {Date}
 */
export function brasiliaMonthStart(now) {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3));
}

/**
 * @typedef {{
 * companyId: string; companyName: string; calls: number; failedCalls: number; costUsd: number;
 * costCents: number; failedCostCents: number; billedCents: number;
 * }} CompanyCost
 */

/**
 * Soma o custo de todas as empresas: o total que a plataforma pagou às IAs e o que cobrou.
 * @param {CompanyCost[]} rows
 * @returns {Omit<CompanyCost, "companyId" | "companyName">}
 */
export function sumCosts(rows) {
  const total = { calls: 0, failedCalls: 0, costUsd: 0, costCents: 0, failedCostCents: 0, billedCents: 0 };
  for (const row of rows) {
    for (const key of Object.keys(total)) total[key] += row[key];
  }
  total.costUsd = Number(total.costUsd.toFixed(6));
  return total;
}

function rpcData({ data, error }, what) {
  if (error) throw new Error(`Não deu para ler ${what}: ${error.message}`);
  return data ?? [];
}

/**
 * Tudo o que o painel mostra: o câmbio, as empresas, o custo das IAs contra o cobrado no mês e as últimas recargas.
 * @param {SupabaseClient} session
 * @param {Date} [now]
 */
export async function loadPlatformPanel(session, now = new Date()) {
  const from = brasiliaMonthStart(now);
  // Um minuto adiante, para não perder o que acabou de acontecer.
  const to = new Date(now.getTime() + 60 * 1000);
  const [overview, companies, costs, entries] = await Promise.all([
    session.rpc("platform_overview"),
    session.rpc("platform_companies"),
    session.rpc("platform_costs", { p_from: from.toISOString(), p_to: to.toISOString() }),
    session.rpc("platform_credit_entries", { p_limit: 50 }),
  ]);

  const [settings] = rpcData(overview, "o câmbio");
  const costRows = rpcData(costs, "o custo das IAs").map((row) => ({
    companyId: row.company_id,
    companyName: row.company_name,
    calls: row.calls,
    failedCalls: row.failed_calls,
    costUsd: Number(row.cost_usd),
    costCents: Number(row.cost_cents),
    failedCostCents: Number(row.failed_cost_cents),
    billedCents: Number(row.billed_cents),
  }));

  return {
    staffName: settings?.staff_name ?? "",
    exchange: {
      usdToBrl: Number(settings?.usd_to_brl),
      updatedAt: settings?.usd_to_brl_updated_at ?? null,
    },
    log: (settings?.recent_log ?? []).map((item) => ({
      id: item.id,
      staffName: item.staff_name,
      action: item.action,
      companyId: item.company_id,
      amountCents: item.amount_cents === null ? null : Number(item.amount_cents),
      usdToBrl: item.usd_to_brl === null ? null : Number(item.usd_to_brl),
      details: item.details,
      createdAt: item.created_at,
    })),
    companies: rpcData(companies, "as empresas").map((row) => ({
      id: row.company_id,
      name: row.company_name,
      createdAt: row.created_at,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      activeMembers: row.active_members,
      balanceCents: Number(row.balance_cents),
      availableCents: Number(row.available_cents),
      monthSpentCents: Number(row.month_spent_cents),
      lastActivityAt: row.last_activity_at,
    })),
    costs: { from: from.toISOString(), rows: costRows, total: sumCosts(costRows) },
    entries: rpcData(entries, "as recargas").map((row) => ({
      id: row.entry_id,
      companyId: row.company_id,
      companyName: row.company_name,
      kind: row.kind,
      amountCents: Number(row.amount_cents),
      description: row.description,
      createdAt: row.created_at,
    })),
  };
}
