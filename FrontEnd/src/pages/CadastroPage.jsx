import { Navigate } from "react-router";
import { SignUpForm } from "../components/SignUpForm.jsx";
import { homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";

export function CadastroPage() {
  const { loading, viewer } = useSession();
  if (loading) return null;
  if (viewer.status === "member") return <Navigate to={homePathFor(viewer.member.role)} replace />;
  return (
    <>
      <title>Criar a conta da empresa · Multi-IA</title>
      <SignUpForm />
    </>
  );
}
