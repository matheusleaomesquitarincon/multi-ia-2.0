// Endereço antigo de uma receita pronta (ex.: /recipes/create-site). As receitas agora abrem dentro do espaço de trabalho,
// na aba Receitas: este endereço leva para lá, com a execução acompanhada (?run=), se houver. Assim links salvos e os
// guias antigos continuam funcionando. Receita que não existe mostra a página "não encontrada".

import { Navigate, useParams, useSearchParams } from "react-router";
import { recipeHref } from "../components/workspace-view.js";
import { useView } from "../lib/useView.js";
import NotFound from "./NotFound.jsx";

export function RecipeRedirectPage() {
  const { recipeId } = useParams();
  const [search] = useSearchParams();
  const { data, loading } = useView(`/api/views/receitas/${encodeURIComponent(recipeId)}`);
  if (loading) return null;
  if (data.notFound) return <NotFound />;
  return <Navigate to={recipeHref(recipeId, search.get("run") ?? undefined)} replace />;
}
