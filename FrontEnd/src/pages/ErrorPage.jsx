// Aparece quando algo dá errado ao montar uma página (ex.: o banco não respondeu).
// A mensagem técnica fica no registro do servidor; a tela só pede para tentar de novo.

import { Link } from "react-router";
import styles from "./error.module.css";

/**
 * @param {{ error: Error & { digest?: string }; retry: () => void }} props
 */
export default function ErrorPage({ retry }) {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Algo deu errado do nosso lado</h1>
      <p className={styles.lead}>Não conseguimos abrir esta página agora. Tente de novo em instantes.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => retry()}>
          Tentar de novo
        </button>
        <Link to="/">Voltar ao início</Link>
      </div>
    </main>
  );
}
