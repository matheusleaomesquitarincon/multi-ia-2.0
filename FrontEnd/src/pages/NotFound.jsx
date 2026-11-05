import { Link } from "react-router";
import styles from "./not-found.module.css";

// Aparece em qualquer endereço que não existe.
export const metadata = {
  title: "Página não encontrada",
};

export default function NotFound() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Página não encontrada</h1>
      <p className={styles.lead}>O endereço pode estar errado, ou esta receita ainda não está pronta.</p>
      <Link to="/">Ver as receitas</Link>
    </main>
  );
}
