// O espaço de trabalho: o chat da tarefa rápida, as receitas, as entregas e os gastos. Só quem é da empresa e está ativo
// recebe estes dados; quem é vem do login, nunca do endereço. Do endereço vêm só a aba e a receita abertas
// (?aba=receitas&receita=create-site).

import { Navigate, useSearchParams } from "react-router";
import { OckWorkspace } from "../components/OckWorkspace.jsx";
import { readWorkspaceView } from "../components/workspace-view.js";
import { firstName } from "../lib/auth/member.js";
import { useView } from "../lib/useView.js";

export function TrabalhoPage() {
  const { data, loading } = useView("/api/views/trabalho");
  const [search] = useSearchParams();

  if (loading) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  const view = readWorkspaceView(
    { aba: search.get("aba") ?? undefined, receita: search.get("receita") ?? undefined },
    data.recipes.map((recipe) => recipe.id),
  );

  return (
    <>
      <title>Trabalhar com o time · Multi-IA</title>
      <OckWorkspace
        pageMemberId={data.me.id}
        firstName={firstName(data.me.name)}
        isOwner={data.me.role === "owner"}
        initialConversations={data.conversations}
        initialMonth={data.month}
        recipeCards={data.recipeCards}
        recipes={data.recipes}
        companyAgents={data.companyAgents}
        initialView={view}
        voice={data.voice}
      />
    </>
  );
}
