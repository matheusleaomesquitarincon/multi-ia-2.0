import { Navigate, useSearchParams } from "react-router";
import { SignInForm } from "../components/SignInForm.jsx";
import { homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";

// Avisos que outras páginas mandam para cá (ex.: /confirmar, quando o link do e-mail não fez o login sozinho).
const NOTICES = new Map([
  ["confirme", "Se você já confirmou o e-mail, é só entrar com a sua senha."],
  [
    "link-vencido",
    "Este link de confirmação venceu ou já foi usado. Se você já confirmou o e-mail, é só entrar; se não, faça o cadastro de novo.",
  ],
]);

export function EntrarPage() {
  const { loading, viewer } = useSession();
  const [search] = useSearchParams();
  if (loading) return null;
  if (viewer.status === "member") return <Navigate to={homePathFor(viewer.member.role)} replace />;
  return (
    <>
      <title>Entrar · Multi-IA</title>
      <SignInForm notice={NOTICES.get(search.get("aviso"))} />
    </>
  );
}
