// A caixinha "Li e aceito os termos de uso e a política de privacidade" (F05). Quem confere se veio marcada é o servidor
// (acceptedTerms, em lib/auth/forms.js); aqui só aparece o aviso que ele devolve. Os links abrem numa aba nova para a
// pessoa não perder o que já digitou.

import styles from "./AuthForm.module.css";

/**
 * @param {{ error?: string }} props
 */
export function TermsCheckbox({ error }) {
  return (
    <div className={styles.field}>
      <label className={styles.check}>
        <input
          type="checkbox"
          name="acceptTerms"
          className={styles.checkInput}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "acceptTerms-error" : undefined}
        />
        <span>
          Li e aceito os{" "}
          <a href="/termos" target="_blank" rel="noopener" className={styles.link}>
            termos de uso
          </a>{" "}
          e a{" "}
          <a href="/privacidade" target="_blank" rel="noopener" className={styles.link}>
            política de privacidade
          </a>
          .
        </span>
      </label>
      {error && (
        <p id="acceptTerms-error" className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
