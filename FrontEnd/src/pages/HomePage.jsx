import { Navigate, useSearchParams } from "react-router";
import { AccountNotice } from "../components/AccountNotice.jsx";
import { OckEntry } from "../components/OckEntry.jsx";
import { homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";

// Página inicial. Quem é da empresa vai direto para a sua página (o dono para o painel, o funcionário para o trabalho);
// quem não entrou vê a porta de entrada.
export function HomePage() {
  const { loading, viewer, demo, staff } = useSession();
  const [search] = useSearchParams();
  if (loading) return null;
  if (viewer.status === "member") return <Navigate to={homePathFor(viewer.member.role)} replace />;
  // Equipe da plataforma sem empresa: vai para o painel interno.
  if (staff) return <Navigate to="/plataforma" replace />;
  // No modo raio-x (só no computador), com ?publica=1 o fundador vê a página inicial como um visitante a veria.
  if (demo && search.get("publica") === "1") return <OckEntry demo={demo} />;
  // No modo raio-x, quem ainda não entrou vai direto para a porta do fundador, sem a tela de login.
  if (demo) return <Navigate to="/raiox" replace />;
  if (viewer.status === "signed-out") return <OckEntry demo={demo} />;
  return <AccountNotice kind={viewer.status} />;
}
