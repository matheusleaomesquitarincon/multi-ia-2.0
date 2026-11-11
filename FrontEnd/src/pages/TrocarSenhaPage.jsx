// Criar a senha: no primeiro acesso do funcionário (entrou pelo convite) ou na volta do "Esqueci minha senha"
// (?motivo=recuperar, F30). Quem chega marcado (mustChangePassword) vê o formulário; quem já tem a própria senha vai
// direto para o seu lugar.

import { Navigate, useSearchParams } from "react-router";
import { ChangePasswordForm } from "../components/ChangePasswordForm.jsx";
import { homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";

export function TrocarSenhaPage() {
  const { loading, viewer } = useSession();
  const [search] = useSearchParams();
  if (loading) return null;
  if (viewer.status === "signed-out") return <Navigate to="/entrar" replace />;
  if (viewer.status !== "member") return <Navigate to="/" replace />;
  if (!viewer.member.mustChangePassword) return <Navigate to={homePathFor(viewer.member.role)} replace />;

  return (
    <>
      <title>Crie a sua senha · Multi-IA</title>
      <ChangePasswordForm
        name={viewer.member.name}
        email={viewer.member.email}
        recovery={search.get("motivo") === "recuperar"}
      />
    </>
  );
}
