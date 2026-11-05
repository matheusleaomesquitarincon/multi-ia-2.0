// O que cada tela precisa para abrir. Antes as páginas liam isto direto no servidor; agora a tela pede aqui. As mesmas
// regras: quem é vem do login, nunca do pedido, e tudo é lido com a sessão da pessoa, então o banco só devolve o que ela
// pode ver. As instruções das IAs nunca saem daqui.

import { DEMO_ACCOUNTS, DEMO_VIEWS, isDemoMode } from "../lib/auth/demo.js";
import { findInvite } from "../lib/auth/invites.js";
import { createSessionClient, signedInSession } from "../lib/auth/session.js";
import { getViewer, requireMember } from "../lib/auth/viewer.js";
import { listCompanyAgents } from "../lib/ock/company-agents.js";
import { deadlineText } from "../lib/ock/deadline.js";
import { loadCompanyCredit, loadMemberMonths, loadMonth, loadMonthStatement } from "../lib/ock/spending.js";
import { listOwnConversations } from "../lib/ock/task-store.js";
import { listTeam } from "../lib/ock/team.js";
import { aiTools } from "../lib/providers/mode.js";
import { getRecipe, listRecipeSummaries, RECIPES } from "../lib/recipes/catalog.js";
import { recipeScreen } from "../lib/recipes/screen.js";
import { stepCosts } from "../lib/runs/estimate.js";
import { notFound } from "../http/navigation.js";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (data) => Response.json(data, { headers: NO_STORE });

/** Quem está vendo: serve para o topo, a página inicial e as telas de entrada decidirem o que mostrar. */
export async function sessionView() {
  let viewer;
  try {
    viewer = await getViewer();
  } catch (error) {
    // O topo nunca derruba o site: se o banco falhar, ele aparece sem a conta.
    console.error("[sessão] Não deu para ler quem está logado:", error instanceof Error ? error.message : error);
    viewer = { status: "signed-out" };
  }
  return json({ viewer, demo: isDemoMode() });
}

export async function workspaceView() {
  const me = await requireMember();
  const session = await signedInSession();
  if (!session) throw new Error("O login sumiu entre conferir a pessoa e ler as conversas.");
  const [conversations, month, companyAgents] = await Promise.all([
    listOwnConversations(session),
    loadMonth(session, me.id),
    listCompanyAgents(session),
  ]);
  return json({
    me,
    conversations,
    month,
    companyAgents,
    // Só o que a tela de cada receita mostra e os números do custo máximo de cada etapa com cada IA.
    recipes: RECIPES.map((recipe) => ({ ...recipeScreen(recipe), stepCosts: stepCosts(recipe) })),
    recipeCards: listRecipeSummaries(),
    voice: aiTools().has("voz"),
  });
}

export async function ownerView() {
  const me = await requireMember("owner");
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Login não configurado.");
  const [team, credit, months, statement, agents] = await Promise.all([
    listTeam(supabase),
    loadCompanyCredit(supabase),
    loadMemberMonths(supabase),
    loadMonthStatement(supabase),
    listCompanyAgents(supabase),
  ]);
  // O banco só entrega o crédito para quem é dono; se não veio, o login mudou entre conferir e ler.
  if (!credit) throw new Error("O crédito da empresa não veio para o dono.");
  return json({ me, team, credit, months, statement, agents, demo: isDemoMode() });
}

/** Abrir o convite só mostra; quem gasta o convite é o botão (routes/actions/convite.js). */
export async function inviteView(_request, context) {
  const { token } = await context.params;
  const invite = await findInvite(token);
  if (invite.status !== "valid") return json({ status: invite.status });

  const viewer = await getViewer();
  const signedInAs = viewer.status === "member" && viewer.member.id !== invite.memberId ? viewer.member.name : null;
  return json({
    status: "valid",
    kind: invite.kind,
    name: invite.name,
    email: invite.email,
    companyName: invite.companyName,
    deadline: deadlineText(invite.expiresAt),
    signedInAs,
  });
}

/** Endereço antigo de uma receita: só confere se ela existe. */
export async function recipeExistsView(_request, context) {
  const { recipeId } = await context.params;
  if (!getRecipe(recipeId)) notFound();
  return json({ ok: true });
}

/** A porta da visão raio-x: fora do modo raio-x, não existe. As senhas de teste nunca vão para o navegador. */
export async function demoView() {
  if (!isDemoMode()) notFound();
  return json({
    accounts: DEMO_VIEWS.map((view) => ({
      view,
      label: DEMO_ACCOUNTS[view].label,
      description: DEMO_ACCOUNTS[view].description,
    })),
  });
}
