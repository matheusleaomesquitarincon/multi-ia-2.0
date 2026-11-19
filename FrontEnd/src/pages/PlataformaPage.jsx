// O painel interno da plataforma: só a equipe recebe os dados. Para os outros o servidor responde "não encontrado",
// e a tela mostra a página de endereço inexistente, sem contar que o painel existe.

import { Navigate } from "react-router";
import { PlatformPanel } from "../components/PlatformPanel.jsx";
import { useView } from "../lib/useView.js";
import NotFound from "./NotFound.jsx";

export function PlataformaPage() {
  const { data, loading } = useView("/api/views/plataforma");
  if (loading) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFound />;
  return (
    <>
      <title>Plataforma · Multi-IA</title>
      <PlatformPanel data={data} />
    </>
  );
}
