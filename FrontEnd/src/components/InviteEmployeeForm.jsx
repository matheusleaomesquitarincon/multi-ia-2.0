// Convidar um funcionário: o dono informa nome, e-mail e o teto do mês e recebe um link para mandar à pessoa.
// Quem confere tudo é o servidor (routes/actions/dono.js); aqui só aparecem os avisos que ele devolve.

import { useActionState, useState } from "react";
import { inviteEmployeeAction } from "../lib/actions.js";
import { NAME_MAX_CHARS } from "../lib/auth/forms.js";
import { PAGE_OWNER_FIELD } from "../lib/ock/team-forms.js";
import { InviteLinkPanel } from "./InviteLinkPanel.jsx";
import styles from "./TeamForms.module.css";

const INITIAL = { status: "idle" };

/**
 * Depois de cada convite, "Convidar outra pessoa" recomeça o formulário do zero. `ownerId` é o dono que abriu o painel:
 * o servidor confere se o login do navegador ainda é o dele.
 * @param {{ ownerId: string }} props
 */
export function InviteEmployee({ ownerId }) {
  const [round, setRound] = useState(0);
  return <InviteEmployeeForm key={round} ownerId={ownerId} onAnother={() => setRound((n) => n + 1)} />;
}

function InviteEmployeeForm({ ownerId, onAnother }) {
  const [state, formAction, pending] = useActionState(inviteEmployeeAction, INITIAL);

  if (state.status === "created") {
    return (
      <div className={styles.stack}>
        <InviteLinkPanel name={state.name} email={state.email} tempPassword={state.tempPassword} />
        <button type="button" className={styles.secondaryButton} onClick={onAnother}>
          Criar outra pessoa
        </button>
      </div>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : undefined;

  // Liga cada campo à sua mensagem (de erro ou de ajuda), para o leitor de tela ler as duas juntas.
  function fieldProps(field, hintId) {
    const error = errors[field];
    return {
      id: `invite-${field}`,
      name: field,
      className: styles.input,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `invite-${field}-error` : hintId,
    };
  }

  function fieldError(field) {
    const error = errors[field];
    return error ? (
      <p id={`invite-${field}-error`} className={styles.fieldError}>
        {error}
      </p>
    ) : null;
  }

  return (
    <form className={styles.inviteForm} action={formAction} noValidate>
      <input type="hidden" name={PAGE_OWNER_FIELD} value={ownerId} />
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="invite-name" className={styles.label}>
            Nome
          </label>
          <input
            {...fieldProps("name")}
            type="text"
            autoComplete="off"
            maxLength={NAME_MAX_CHARS}
            defaultValue={values?.name}
          />
          {fieldError("name")}
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-email" className={styles.label}>
            E-mail
          </label>
          <input
            {...fieldProps("email", "invite-email-hint")}
            type="email"
            autoComplete="off"
            defaultValue={values?.email}
          />
          {fieldError("email") ?? (
            <p id="invite-email-hint" className={styles.hint}>
              É com ele que a pessoa vai entrar.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-budget" className={styles.label}>
            Teto do mês (R$)
          </label>
          <input
            {...fieldProps("budget", "invite-budget-hint")}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex.: 50,00"
            defaultValue={values?.budget}
          />
          {fieldError("budget") ?? (
            <p id="invite-budget-hint" className={styles.hint}>
              Vazio = sem teto. Renova todo dia 1º.
            </p>
          )}
        </div>
      </div>

      {state.status === "error" && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Criando…" : "Criar funcionário"}
      </button>
    </form>
  );
}
