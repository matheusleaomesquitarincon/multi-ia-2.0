// O texto final de uma receita, com o título, as seções, as listas e os destaques que a IA marcou
// (lib/ock/rich-text.js). Tudo entra na página como texto: nada do que a IA escreveu vira código aqui.

import { parseRichText } from "../lib/ock/rich-text.js";
import styles from "./RichText.module.css";

/**
 * @typedef {{
 * text: string;
 * }} RichTextProps
 */

/**
 * @param {RichTextProps} props
 */
export function RichText({ text }) {
  return <div className={styles.text}>{groupItems(parseRichText(text)).map(renderGroup)}</div>;
}

/** Itens de lista seguidos viram uma lista só. */
/** @typedef {TextBlock | { kind: "list"; items: TextBlock[] }} Group */

function groupItems(blocks) {
  const groups = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.kind !== "item") groups.push(block);
    else if (last?.kind === "list") last.items.push(block);
    else groups.push({ kind: "list", items: [block] });
  }
  return groups;
}

function renderGroup(group, index) {
  switch (group.kind) {
    case "list":
      return (
        <ul key={index} className={styles.list}>
          {group.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderSpans(item.spans)}</li>
          ))}
        </ul>
      );
    // A página já tem o título da tela (h2); o título do texto vem logo abaixo.
    case "title":
      return (
        <h3 key={index} className={styles.title}>
          {renderSpans(group.spans)}
        </h3>
      );
    case "heading":
      return (
        <h4 key={index} className={styles.heading}>
          {renderSpans(group.spans)}
        </h4>
      );
    default:
      return (
        <p key={index} className={styles.paragraph}>
          {renderSpans(group.spans)}
        </p>
      );
  }
}

function renderSpans(spans) {
  return spans.map((span, index) => (span.bold ? <strong key={index}>{span.text}</strong> : span.text));
}
