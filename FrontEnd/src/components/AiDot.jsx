import styles from "./AiDot.module.css";

/**
 * @typedef {{
 * provider: ProviderId;
 * size?: "small" | "large";
 * }} AiDotProps
 */

// Bolinha com a cor da IA. É só enfeite: o nome da IA sempre aparece escrito ao lado.
/**
 * @param {AiDotProps} props
 */
export function AiDot({ provider, size = "small" }) {
  const className = [styles.dot, styles[provider], size === "large" && styles.large].filter(Boolean).join(" ");

  return <span className={className} aria-hidden="true" />;
}
