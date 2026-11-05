// A equipe da empresa, como o dono vê no painel. Tudo aqui usa a sessão de quem está logado: as regras de acesso do
// banco só devolvem a equipe inteira (e os convites) para o dono, e só deixam o dono mudar teto e situação dos
// funcionários da empresa dele. O convite em si (criar login, gerar link) fica em lib/auth/invites.js.

/** @typedef {"active" | "disabled"} MemberStatus */

/** O link que a pessoa ainda não usou: o primeiro convite ou o de senha nova. */
/**
 * @typedef {{
 * kind: InviteKind;
 * expiresAt: string;
 * expired: boolean;
 * }} PendingInvite
 */

/**
 * @typedef {{
 * id: string;
 * name: string;
 * email: string;
 * role: MemberRole;
 * // Teto de gasto por mês, em centavos de real. null = sem teto.
 * monthlyBudgetCents: number | null;
 * status: MemberStatus;
 * invite: PendingInvite | null;
 * }} TeamMember
 */

/**
 * Confere cada campo da linha que o banco devolve (ver parseMemberRow em lib/auth/member.js).
 * @param {unknown} row
 * @returns {Omit<TeamMember, "invite">}
 */
export function parseTeamRow(row) {
  if (typeof row !== "object" || row === null) throw new Error("Pessoa da equipe em formato inesperado.");
  const r = row;
  const budget = r.monthly_budget_cents;
  const budgetOk = budget === null || (typeof budget === "number" && Number.isInteger(budget) && budget >= 0);

  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.email !== "string" || !budgetOk) {
    throw new Error("Pessoa da equipe com cadastro incompleto.");
  }
  if (r.role !== "owner" && r.role !== "employee") throw new Error("Papel desconhecido na equipe.");
  if (r.status !== "active" && r.status !== "disabled") throw new Error("Situação desconhecida na equipe.");

  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    monthlyBudgetCents: budget,
    status: r.status,
  };
}

/**
 * Lê um convite pendente. `now` decide se ele já venceu.
 * @param {unknown} row
 * @param {Date} now
 * @returns {{ memberId: string; invite: PendingInvite }}
 */
export function parseInviteRow(row, now) {
  if (typeof row !== "object" || row === null) throw new Error("Convite em formato inesperado.");
  const r = row;
  const expiresMs = typeof r.expires_at === "string" ? Date.parse(r.expires_at) : NaN;
  if (typeof r.member_id !== "string" || Number.isNaN(expiresMs)) throw new Error("Convite incompleto.");
  if (r.kind !== "invite" && r.kind !== "reset") throw new Error("Tipo de convite desconhecido.");
  return {
    memberId: r.member_id,
    invite: { kind: r.kind, expiresAt: new Date(expiresMs).toISOString(), expired: expiresMs <= now.getTime() },
  };
}

/**
 * O dono primeiro; depois os funcionários em ordem alfabética.
 * @param {TeamMember[]} team
 * @returns {TeamMember[]}
 */
export function sortTeam(team) {
  return [...team].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/**
 * @param {SupabaseClient} supabase
 * @returns {Promise<TeamMember[]>}
 */
export async function listTeam(supabase, now = new Date()) {
  const [members, invites] = await Promise.all([
    supabase.from("members").select("id, name, email, role, monthly_budget_cents, status"),
    supabase.from("member_invites").select("member_id, kind, expires_at"),
  ]);
  if (members.error) throw new Error(`Não deu para ler a equipe: ${members.error.message}`);
  if (invites.error) throw new Error(`Não deu para ler os convites: ${invites.error.message}`);

  const inviteOf = new Map(
    (invites.data ?? []).map((row) => parseInviteRow(row, now)).map(({ memberId, invite }) => [memberId, invite]),
  );
  return sortTeam(
    (members.data ?? []).map(parseTeamRow).map((person) => ({ ...person, invite: inviteOf.get(person.id) ?? null })),
  );
}

/**
 * Um funcionário da empresa de quem está logado, ou null se não houver (ou se for o dono).
 * @param {SupabaseClient} supabase
 * @param {string} memberId
 * @returns {Promise<{ id: string; status: MemberStatus } | null>}
 */
export async function findEmployee(supabase, memberId) {
  const { data, error } = await supabase.from("members").select("id, role, status").eq("id", memberId).maybeSingle();
  if (error) throw new Error(`Não deu para ler a pessoa da equipe: ${error.message}`);
  if (!data || data.role !== "employee") return null;
  return { id: data.id, status: data.status === "disabled" ? "disabled" : "active" };
}

/** @typedef {{ monthly_budget_cents: number | null } | { status: MemberStatus }} EmployeeChange */

/**
 * Muda o teto ou a situação de um funcionário. Devolve false se nada mudou: as regras do banco só deixam o dono
 * mexer em funcionários da própria empresa, então outra pessoa (ou um id inventado) não muda nada.
 * @param {SupabaseClient} supabase
 * @param {string} memberId
 * @param {EmployeeChange} change
 * @returns {Promise<boolean>}
 */
export async function updateEmployee(supabase, memberId, change) {
  const { data, error } = await supabase.from("members").update(change).eq("id", memberId).select("id");
  if (error) throw new Error(`Não deu para mudar a pessoa da equipe: ${error.message}`);
  return (data ?? []).length > 0;
}

export { deadlineText } from "./deadline.js";
