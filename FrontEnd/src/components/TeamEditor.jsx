// Montar (ou mudar) um time de IA: a receita própria (F08). No alto, o time desenhado como uma linha de trabalho
// (quem passa para quem), que muda na hora; embaixo, um cartão por membro com o nome, a IA e o que ele faz. Os modelos
// prontos (Pesquisador, Redator, Revisor...) enchem um membro novo para começar mais rápido.
// A tela confere o time antes de mandar (lib/recipes/custom-form.js); o servidor confere de novo.

import { Fragment, useId, useState } from "react";

import { saveCustomRecipe } from "../lib/ock/chat-client.js";
import { PROVIDERS } from "../lib/providers/catalog.js";
import {
  MAX_INSTRUCTION,
  MAX_MEMBER_NAME,
  MAX_MEMBERS,
  MAX_RECIPE_NAME,
  MEMBER_TEMPLATES,
  MIN_MEMBERS,
  parseCustomRecipe,
} from "../lib/recipes/custom-form.js";
import { AiDot } from "./AiDot.jsx";
import styles from "./TeamEditor.module.css";

/** Um time novo começa com dois membros: quem prepara e quem escreve. */
const STARTER = [MEMBER_TEMPLATES[0], MEMBER_TEMPLATES[2]];

/**
 * @typedef {{
 * pageMemberId: string;
 * // O time que está sendo mudado (id do banco e o time); null para montar um novo.
 * editing: { id: string; form: CustomRecipeForm } | null;
 * onSaved: () => void;
 * onCancel: () => void;
 * }} TeamEditorProps
 */

/**
 * @param {TeamEditorProps} props
 */
export function TeamEditor({ pageMemberId, editing, onSaved, onCancel }) {
  const ids = useId();
  const [name, setName] = useState(editing?.form.name ?? "");
  const [visibility, setVisibility] = useState(editing?.form.visibility ?? "private");
  // Cada membro ganha uma chave própria, para o React não confundir os cartões ao mover ou tirar um.
  const [members, setMembers] = useState(() =>
    (editing?.form.members ?? STARTER).map((member) => ({ ...member, key: crypto.randomUUID() })),
  );
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);

  function change(key, patch) {
    setMembers((current) => current.map((member) => (member.key === key ? { ...member, ...patch } : member)));
  }

  function move(index, delta) {
    setMembers((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  function remove(key) {
    setMembers((current) => current.filter((member) => member.key !== key));
  }

  function add(template) {
    setMembers((current) =>
      current.length >= MAX_MEMBERS ? current : [...current, { ...template, key: crypto.randomUUID() }],
    );
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const form = { name, visibility, members: members.map(({ name: n, provider, instruction }) => ({ name: n, provider, instruction })) };
    const parsed = parseCustomRecipe(form);
    if (!parsed.ok) {
      setProblems(parsed.problems);
      return;
    }
    setSaving(true);
    setProblems([]);
    const result = await saveCustomRecipe(parsed.form, editing?.id ?? null, pageMemberId);
    setSaving(false);
    if (!result.ok) {
      setProblems([result.problem]);
      return;
    }
    onSaved();
  }

  const full = members.length >= MAX_MEMBERS;

  return (
    <form className={styles.editor} onSubmit={(event) => void save(event)} noValidate>
      <div className={styles.head}>
        <h3 className={styles.title}>{editing ? "Mudar o time" : "Montar um time"}</h3>
        <p className={styles.lead}>
          Os membros trabalham um depois do outro: cada um recebe o seu pedido e o que o anterior fez. O último entrega o
          resultado em Word.
        </p>
      </div>

      {/* O time como uma linha de trabalho, atualizada a cada mudança. */}
      <ol className={styles.flow} aria-label="A ordem do time">
        <li className={styles.flowEnd}>Seu pedido</li>
        {members.map((member, index) => (
          <Fragment key={member.key}>
            <li className={styles.flowArrow} aria-hidden="true">
              →
            </li>
            <li className={styles.flowStep}>
              <AiDot provider={member.provider} />
              <span>{member.name.trim() || `Membro ${index + 1}`}</span>
            </li>
          </Fragment>
        ))}
        <li className={styles.flowArrow} aria-hidden="true">
          →
        </li>
        <li className={styles.flowEnd}>Word</li>
      </ol>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Nome do time</span>
          <input
            className={styles.input}
            value={name}
            maxLength={MAX_RECIPE_NAME}
            placeholder="Ex.: Post para o blog da clínica"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset className={styles.visibility}>
          <legend className={styles.label}>Quem pode usar</legend>
          <label className={styles.radio}>
            <input
              type="radio"
              name={`${ids}-visibility`}
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            Só eu
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name={`${ids}-visibility`}
              checked={visibility === "company"}
              onChange={() => setVisibility("company")}
            />
            A empresa toda
          </label>
        </fieldset>
      </div>

      <ol className={styles.members}>
        {members.map((member, index) => (
          <li key={member.key} className={styles.member}>
            <div className={styles.memberHead}>
              <span className={styles.position} aria-hidden="true">
                {index + 1}
              </span>
              <label className={styles.memberName}>
                <span className={styles.visuallyHidden}>Nome do membro {index + 1}</span>
                <input
                  className={styles.input}
                  value={member.name}
                  maxLength={MAX_MEMBER_NAME}
                  placeholder="Ex.: Redator"
                  onChange={(event) => change(member.key, { name: event.target.value })}
                />
              </label>
              <div className={styles.memberTools}>
                <button
                  type="button"
                  className={styles.tool}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  title="Subir"
                >
                  <span aria-hidden="true">↑</span>
                  <span className={styles.visuallyHidden}>Subir o membro {index + 1}</span>
                </button>
                <button
                  type="button"
                  className={styles.tool}
                  onClick={() => move(index, 1)}
                  disabled={index === members.length - 1}
                  title="Descer"
                >
                  <span aria-hidden="true">↓</span>
                  <span className={styles.visuallyHidden}>Descer o membro {index + 1}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.tool} ${styles.toolDanger}`}
                  onClick={() => remove(member.key)}
                  disabled={members.length <= MIN_MEMBERS}
                  title="Tirar do time"
                >
                  <span aria-hidden="true">×</span>
                  <span className={styles.visuallyHidden}>Tirar o membro {index + 1} do time</span>
                </button>
              </div>
            </div>

            <fieldset className={styles.providers}>
              <legend className={styles.visuallyHidden}>IA do membro {index + 1}</legend>
              {PROVIDERS.map((provider) => (
                <label
                  key={provider.id}
                  className={member.provider === provider.id ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                >
                  <input
                    type="radio"
                    className={styles.visuallyHidden}
                    name={`${ids}-${member.key}-provider`}
                    checked={member.provider === provider.id}
                    onChange={() => change(member.key, { provider: provider.id })}
                  />
                  <AiDot provider={provider.id} />
                  {provider.name}
                </label>
              ))}
            </fieldset>

            <label className={styles.field}>
              <span className={styles.label}>O que este membro faz</span>
              <textarea
                className={styles.textarea}
                rows={3}
                value={member.instruction}
                maxLength={MAX_INSTRUCTION}
                placeholder="Ex.: Escreva o texto completo com base no que o membro anterior preparou."
                onChange={(event) => change(member.key, { instruction: event.target.value })}
              />
              <span className={styles.counter}>
                {member.instruction.length}/{MAX_INSTRUCTION}
              </span>
            </label>
          </li>
        ))}
      </ol>

      <div className={styles.add}>
        <span className={styles.label}>{full ? `O time já tem ${MAX_MEMBERS} membros.` : "Adicionar membro:"}</span>
        {MEMBER_TEMPLATES.map((template) => (
          <button
            key={template.name}
            type="button"
            className={styles.addChip}
            onClick={() => add(template)}
            disabled={full}
          >
            + {template.name}
          </button>
        ))}
      </div>

      {problems.length > 0 && (
        <div className={styles.problems} role="alert">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? "Salvando…" : editing ? "Salvar mudanças" : "Salvar time"}
        </button>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
