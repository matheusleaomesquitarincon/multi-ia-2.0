// "Esqueci minha senha" (F30). Quem já está logado não precisa: vai para o seu lugar.

import { Navigate } from "react-router";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm.jsx";
import { homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";

export function EsqueciSenhaPage() {
  const { loading, viewer } = useSession();
  if (loading) return null;
  if (viewer.status === "member") return <Navigate to={homePathFor(viewer.member.role)} replace />;
  return (
    <>
      <title>Esqueci minha senha · Multi-IA</title>
      <ForgotPasswordForm />
    </>
  );
}
