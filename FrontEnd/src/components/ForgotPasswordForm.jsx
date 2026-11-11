// "Esqueci minha senha": a pessoa digita o e-mail e recebe um link para criar uma senha nova. Quem confere e manda o
// e-mail é o servidor (routes/actions/esqueci-senha.js), que responde do mesmo jeito exista ou não a conta.

import { Link } from "react-router";
import { useActionState } from "react";
import { forgotPasswordAction } from "../lib/actions.js";

import styles from "./AuthForm.module.css";

const INITIAL = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, INITIAL);

  if (state.status === "check-email") {
    return (
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="forgot-sent-title">
          <h1 id="forgot-sent-title" className={styles.title}>
            Confira o seu e-mail
          </h1>
          <p className={styles.lead}>
            Se existe uma conta com <strong>{state.email}</strong>, mandamos para lá um link para criar uma senha nova.
          </p>
          <p className={styles.hint}>Não chegou em alguns minutos? Veja a caixa de spam ou confira se o e-mail está certo.</p>
          <p className={styles.footer}>
            Lembrou a senha?{" "}
            <Link to="/entrar" className={styles.link}>
              Entrar
            </Link>
          </p>
        </section>
      </main>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const email = state.status === "idle" ? undefined : state.values.email;

  return (
    <main className={styles.main}>
      <form className={styles.card} action={formAction} noValidate aria-labelledby="forgot-title">
        <h1 id="forgot-title" className={styles.title}>
          Esqueci minha senha
        </h1>
        <p className={styles.lead}>Digite o e-mail com que você entra. Vamos mandar um link para criar uma senha nova.</p>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            E-mail
          </label>
          <input
            id="email"
            name="email"
            className={styles.input}
            type="email"
            autoComplete="username"
            defaultValue={email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className={styles.fieldError}>
              {errors.email}
            </p>
          )}
        </div>

        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}

        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Mandando…" : "Mandar o link"}
        </button>

        <p className={styles.footer}>
          <Link to="/entrar" className={styles.link}>
            Voltar para Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
