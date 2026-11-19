// Aceitar os termos (F05): para quem já tinha conta antes deles ou quando a versão muda. O servidor manda para cá
// (requireMember); quem já aceitou vai direto para o seu lugar.

import { useActionState } from "react";
import { Navigate } from "react-router";
import { TermsCheckbox } from "../components/TermsCheckbox.jsx";
import { acceptTermsAction } from "../lib/actions.js";
import { firstName, homePathFor } from "../lib/auth/member.js";
import { useSession } from "../lib/session.jsx";
import styles from "../components/AuthForm.module.css";

const INITIAL = { status: "idle" };

export function AceitarTermosPage() {
  const { loading, viewer } = useSession();
  const [state, formAction, pending] = useActionState(acceptTermsAction, INITIAL);
  if (loading) return null;
  if (viewer.status === "signed-out") return <Navigate to="/entrar" replace />;
  if (viewer.status !== "member") return <Navigate to="/" replace />;
  if (!viewer.member.needsTerms) return <Navigate to={homePathFor(viewer.member.role)} replace />;

  const errors = state.status === "invalid" ? state.errors : {};
  return (
    <main className={styles.main}>
      <title>Termos de uso · Multi-IA</title>
      <form className={styles.card} action={formAction} noValidate aria-labelledby="terms-title">
        <p className={styles.kicker}>Antes de continuar</p>
        <h1 id="terms-title" className={styles.title}>
          Olá, {firstName(viewer.member.name)}!
        </h1>
        <p className={styles.lead}>
          Publicamos os termos de uso e a política de privacidade da plataforma. Eles explicam como os créditos funcionam,
          para onde vão os seus pedidos e o que o dono da empresa vê (as entregas e os gastos, nunca as suas conversas).
        </p>

        <TermsCheckbox error={errors.acceptTerms} />

        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}

        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Salvando…" : "Aceitar e continuar"}
        </button>
      </form>
    </main>
  );
}
