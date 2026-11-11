// O topo das páginas de quem está logado (espaço de trabalho e painel do dono), no visual editorial: um rótulo pequeno,
// o título em serifa com o final em itálico e, ao lado, os números que a pessoa mais olha.

import styles from "./PageHeader.module.css";

/**
 * @typedef {{ label: string; value: React.ReactNode; note?: React.ReactNode }} HeaderStat
 */

/**
 * @param {{
 * eyebrow: string;
 * title: React.ReactNode;
 * titleEm?: React.ReactNode;
 * lead?: React.ReactNode;
 * stats?: HeaderStat[];
 * }} props
 */
export function PageHeader({ eyebrow, title, titleEm, lead, stats = [] }) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>
          {title}
          {titleEm && (
            <>
              {" "}
              <em className={styles.titleEm}>{titleEm}</em>
            </>
          )}
        </h1>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
      {stats.length > 0 && (
        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt className={styles.statLabel}>{stat.label}</dt>
              <dd className={styles.statValue}>{stat.value}</dd>
              {stat.note && <dd className={styles.statNote}>{stat.note}</dd>}
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
