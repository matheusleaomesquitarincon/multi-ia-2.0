import { Navigate } from "react-router";
import { AccountNotice } from "../components/AccountNotice.jsx";
import { OckEntry } from "../components/OckEntry.jsx";
import { homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";

// Página inicial. Quem é da empresa vai direto para a sua página (o dono para o painel, o funcionário para o trabalho);
// quem não entrou vê a porta de entrada.
export function HomePage() {
  const { loading, viewer, demo } = useSession();
  if (loading) return null;
  // No modo raio-x (só no computador), o fundador entra direto na sua porta, sem passar pela tela de login dos usuários.
  if (demo) return <Navigate to="/raiox" replace />;
  if (viewer.status === "member") return <Navigate to={homePathFor(viewer.member.role)} replace />;
  if (viewer.status === "signed-out") return <OckEntry demo={demo} />;
  return <AccountNotice kind={viewer.status} />;
}
