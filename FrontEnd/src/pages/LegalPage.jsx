// Termos de uso (/termos) e política de privacidade (/privacidade): páginas abertas, sem login, para ler antes de
// aceitar. O texto fica em legal-texts.js.

import { Link } from "react-router";
import { PRIVACY, TERMS } from "./legal-texts.js";
import { TERMS_VERSION } from "../lib/auth/forms.js";
import styles from "./legal.module.css";

/**
 * @param {{ kind: "terms" | "privacy" }} props
 */
export function LegalPage({ kind }) {
  const text = kind === "terms" ? TERMS : PRIVACY;
  const other = kind === "terms" ? { to: "/privacidade", label: "Política de privacidade" } : { to: "/termos", label: "Termos de uso" };

  return (
    <main className={styles.main}>
      <title>{`${text.title} · Multi-IA`}</title>
      <header className={styles.intro}>
        <p className={styles.draft} role="note">
          Rascunho, ainda sem revisão jurídica. O que está entre [colchetes] será preenchido antes da primeira empresa.
        </p>
        <h1 className={styles.title}>{text.title}</h1>
        <p className={styles.lead}>{text.lead}</p>
        <p className={styles.meta}>Versão de {formatVersion(TERMS_VERSION)}</p>
      </header>

      {text.sections.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2 className={styles.heading}>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className={styles.footer}>
        Leia também: <Link to={other.to}>{other.label}</Link>
      </p>
    </main>
  );
}

/** "2026-11-18" -> "18/11/2026". */
function formatVersion(version) {
  const [year, month, day] = version.split("-");
  return `${day}/${month}/${year}`;
}
