// Aviso para quem ainda não confirmou o e-mail (F32): pede um código, que chega no e-mail do login, e digita aqui. Não
// bloqueia nada: só some quando o e-mail é confirmado. Quem confere é o servidor (routes/actions/conta.js).

import { useActionState } from "react";
import { sendEmailCodeAction, verifyEmailCodeAction } from "../lib/actions.js";
import forms from "./TeamForms.module.css";
import styles from "./EmailCheck.module.css";

const INITIAL = { status: "idle" };

/**
 * @param {{ email: string }} props
 */
export function EmailCheck({ email }) {
  const [sent, sendAction, sending] = useActionState(sendEmailCodeAction, INITIAL);
  const [checked, verifyAction, verifying] = useActionState(verifyEmailCodeAction, INITIAL);

  if (checked.status === "verified" || sent.status === "verified") {
    return (
      <aside className={styles.box} role="status">
        <p className={styles.done}>E-mail confirmado. Obrigado!</p>
      </aside>
    );
  }

  const codeSent = sent.status === "sent";
  return (
    <aside className={styles.box} aria-labelledby="email-check-title">
      <div className={styles.text}>
        <h2 id="email-check-title" className={styles.title}>
          Confirme o seu e-mail
        </h2>
        <p className={styles.lead}>
          O seu login é <strong>{email}</strong>. Confirme que ele é seu: mandamos um código de 6 números para ele.
          Se o e-mail estiver errado, peça ao dono da empresa para corrigir.
        </p>
      </div>
      <div className={styles.forms}>
        <form action={sendAction}>
          <input type="hidden" name="send" value="1" />
          <button type="submit" className={codeSent ? forms.secondaryButton : forms.primaryButton} disabled={sending}>
            {sending ? "Mandando…" : codeSent ? "Mandar outro código" : "Mandar o código"}
          </button>
        </form>
        {codeSent && (
          <form action={verifyAction} className={styles.codeForm}>
            <label htmlFor="email-code" className={forms.label}>
              Código do e-mail
            </label>
            <div className={styles.codeRow}>
              <input
                id="email-code"
                name="code"
                className={`${forms.input} ${styles.codeInput}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <button type="submit" className={forms.primaryButton} disabled={verifying}>
                {verifying ? "Conferindo…" : "Confirmar"}
              </button>
            </div>
          </form>
        )}
        {sent.status === "error" && (
          <p className={forms.error} role="alert">
            {sent.message}
          </p>
        )}
        {checked.status === "error" && (
          <p className={forms.error} role="alert">
            {checked.message}
          </p>
        )}
        {codeSent && checked.status !== "error" && (
          <p className={forms.hint}>Não chegou? Veja a caixa de spam ou peça outro em um minuto.</p>
        )}
      </div>
    </aside>
  );
}
