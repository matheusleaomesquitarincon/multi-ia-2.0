// Página só local (modo raio-x): escolhe de qual lado ver o site. Fora do modo raio-x, o servidor diz que não existe.

import { DemoKeys } from "../components/DemoKeys.jsx";
import { entrarComoDemo } from "../lib/actions.js";
import { useView } from "../lib/useView.js";
import NotFound from "./NotFound.jsx";
import styles from "./raiox.module.css";

export function RaioXPage() {
  const { data, loading } = useView("/api/views/raiox");
  if (loading) return null;
  if (data.notFound) return <NotFound />;

  return (
    <main className={styles.main}>
      <title>Visão raio-x (local) · Multi-IA</title>
      <section className={styles.intro}>
        <p className={styles.kicker}>Visão raio-x · só no seu computador</p>
        <h1 className={styles.title}>Entre e veja o site inteiro</h1>
        <p className={styles.lead}>
          Sem login, e-mail nem crédito. Escolha de qual lado ver — você pode trocar a qualquer hora pelo topo da
          página. Esta porta não existe no site publicado.
        </p>
        <p className={styles.lead}>
          <a href="/?publica=1">Ver a página inicial como um visitante</a>
        </p>
      </section>

      <div className={styles.columns}>
        {data.accounts.map((account) => (
          <form key={account.view} action={() => entrarComoDemo(account.view)} className={styles.card}>
            <h2 className={styles.cardTitle}>{account.label}</h2>
            <p className={styles.cardText}>{account.description}</p>
            <button type="submit" className={styles.button}>
              {account.label}
            </button>
          </form>
        ))}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Conectar chaves de IA (teste)</h2>
        <p className={styles.cardText}>
          Cole suas chaves da plataforma para usar a IA de verdade aqui no computador, sem editar arquivo. Ficam só nesta
          máquina (fora do Git e do site publicado). Sem chave, tudo continua simulado.
        </p>
        <DemoKeys />
      </div>
    </main>
  );
}
