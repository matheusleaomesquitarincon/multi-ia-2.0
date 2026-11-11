// A escolha livre da IA e do nível no chat (F03). "Automático" deixa o Chefe decidir (o padrão). Quem confere e aplica é o
// servidor (lib/ock/quick-task.js, planWithChoice): a imagem continua no GPT, e outra IA numa pesquisa ou numa conta
// responde sem a ferramenta, com o aviso de sempre.

import { useId } from "react";
import { TIER_LABEL } from "../lib/ock/chat.js";
import { PROVIDERS } from "../lib/providers/catalog.js";

import styles from "./ModelChoicePicker.module.css";

/**
 * @param {{ choice: ModelChoice; onChange: (choice: ModelChoice) => void; disabled?: boolean }} props
 */
export function ModelChoicePicker({ choice, onChange, disabled = false }) {
  const ids = useId();
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.visuallyHidden}>Quem responde esta mensagem</legend>
      <label htmlFor={`${ids}-provider`} className={styles.label}>
        IA
      </label>
      <select
        id={`${ids}-provider`}
        className={styles.select}
        value={choice.provider ?? ""}
        onChange={(event) => onChange({ ...choice, provider: event.target.value || null })}
      >
        <option value="">Automática</option>
        {PROVIDERS.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
      <label htmlFor={`${ids}-tier`} className={styles.label}>
        Nível
      </label>
      <select
        id={`${ids}-tier`}
        className={styles.select}
        value={choice.tier ?? ""}
        onChange={(event) => onChange({ ...choice, tier: event.target.value || null })}
      >
        <option value="">Automático</option>
        {Object.entries(TIER_LABEL).map(([tier, label]) => (
          <option key={tier} value={tier}>
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
