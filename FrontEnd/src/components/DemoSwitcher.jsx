import { entrarComoDemo } from "../lib/actions.js";

import styles from "./DemoSwitcher.module.css";

const VIEWS = ["chefe", "funcionario"];

// Barra da visão raio-x, abaixo do topo (SÓ local): troca entre ver como Chefe e como Funcionário a qualquer hora.
// Só é montada quando o modo raio-x está ligado (quem decide é o SiteHeader).
export function DemoSwitcher() {
  return (
    <div className={styles.bar}>
      <span className={styles.label}>🕶️ Visão raio-x</span>
      <span className={styles.hint}>ver o site como</span>
      <div className={styles.buttons}>
        {VIEWS.map((view) => (
          <form key={view} action={() => entrarComoDemo(view)}>
            <button type="submit" className={styles.button}>
              {view === "chefe" ? "Chefe" : "Funcionário"}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
