// A recarga de teste do painel do dono: SÓ aparece na visão raio-x (no computador). Põe crédito fictício na empresa
// para testar à vontade. Cada pedido é conferido de novo no servidor (routes/actions/dono.js: modo raio-x + dono logado).

import { useActionState } from "react";
import { demoTopupAction } from "../lib/actions.js";
import { PAGE_OWNER_FIELD } from "../lib/ock/team-forms.js";
import styles from "./TeamForms.module.css";

const IDLE = { status: "idle" };

/**
 * @param {{ ownerId: string }} props
 */
export function DemoRecharge({ ownerId }) {
  const [state, formAction, pending] = useActionState(demoTopupAction, IDLE);

  return (
    <form className={styles.inlineForm} action={formAction} noValidate>
      <input type="hidden" name={PAGE_OWNER_FIELD} value={ownerId} />
      <div className={styles.field}>
        <label htmlFor="demo-amount" className={styles.label}>
          Quanto adicionar (R$)
        </label>
        <input
          id="demo-amount"
          name="amount"
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue="1000"
        />
      </div>
      {state.status === "error" && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <p className={styles.hint} role="status">
          Crédito de teste adicionado.
        </p>
      )}
      <div className={styles.buttons}>
        <button type="submit" className={styles.smallPrimary} disabled={pending}>
          {pending ? "Adicionando…" : "Recarregar (teste)"}
        </button>
      </div>
    </form>
  );
}
