// A história do mês da empresa, no alto do painel do dono: o que entrou, o que a equipe fez, para onde foi o gasto e como
// o mês está agora. Só conta o que os números já dizem, com os dados que o painel recebe: nada de pedidos nem conversas.

import { formatBRL } from "../lib/ock/pricing.js";
import { getProviderInfo } from "../lib/providers/catalog.js";
import { Reveal } from "./Reveal.jsx";
import styles from "./MonthStory.module.css";

const count = (value, one, many) => `${value.toLocaleString("pt-BR")} ${value === 1 ? one : many}`;

/** Os capítulos do mês, em ordem. Exportado para os testes. */
export function monthChapters({ credit, topupCents, topupPartial, runs, deliveries, topPerson }) {
  const topProvider = credit.byProvider
    .filter((line) => line.provider !== null && line.spentCents > 0)
    .reduce((top, line) => (top && top.spentCents >= line.spentCents ? top : line), null);

  const spentParts = [];
  if (topProvider) spentParts.push(`A IA mais usada foi o ${getProviderInfo(topProvider.provider).name}.`);
  if (topPerson) spentParts.push(`${topPerson.name} foi quem mais gastou: ${formatBRL(topPerson.spentCents)}.`);

  return [
    {
      id: "entrou",
      title: "O que entrou",
      figure: formatBRL(topupCents),
      text:
        topupCents > 0
          ? `Em recargas neste mês${topPartial(topupPartial)}.`
          : "Nenhuma recarga entrou neste mês ainda.",
    },
    {
      id: "fez",
      title: "O que a equipe fez",
      figure: count(runs, "execução", "execuções"),
      text: runs > 0 ? `E ${count(deliveries, "entrega", "entregas")} para baixar.` : "Ninguém usou as IAs neste mês ainda.",
    },
    {
      id: "gastou",
      title: "Para onde foi o gasto",
      figure: formatBRL(credit.monthSpentCents),
      text: spentParts.length > 0 ? spentParts.join(" ") : "Ninguém da equipe gastou neste mês ainda.",
    },
    {
      id: "agora",
      title: "Como está agora",
      figure: formatBRL(Math.max(0, credit.availableCents)),
      text:
        credit.availableCents > 0
          ? "Disponíveis para a equipe continuar trabalhando."
          : "A empresa está sem crédito: ninguém da equipe consegue usar as IAs.",
      alert: credit.availableCents <= 0,
    },
  ];
}

function topPartial(partial) {
  return partial ? " (soma das recargas mais recentes)" : "";
}

/**
 * @param {{ credit: any, topupCents: number, topupPartial: boolean, runs: number, deliveries: number, topPerson: { name: string, spentCents: number } | null }} props
 */
export function MonthStory(props) {
  return (
    <section className={styles.story} aria-labelledby="month-story-title">
      <h2 id="month-story-title" className={styles.title}>
        A história do mês
      </h2>
      <ol className={styles.chapters}>
        {monthChapters(props).map((chapter, index) => (
          <Reveal as="li" key={chapter.id} delay={index * 90} className={styles.chapter}>
            <p className={styles.chapterTitle}>{chapter.title}</p>
            <p className={chapter.alert ? styles.figureAlert : styles.figure}>{chapter.figure}</p>
            <p className={styles.text}>{chapter.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
