// O uso de cada dia, em barras (aba "Meu time", F08). Uma série só: a cor de destaque, sem legenda (o título diz o que
// é). Cada barra mostra o valor ao passar o mouse; para quem usa leitor de tela, os mesmos números vão numa tabela
// escondida (e o total de hoje fica escrito no alto da aba). Dia sem gasto ganha um traço na base, para a linha do
// tempo não ter buraco.

import styles from "./UsageChart.module.css";

/**
 * @typedef {{
 * days: DayUsage[];
 * // Como escrever o valor (créditos para o funcionário, reais para o dono).
 * format: (cents: number) => string;
 * }} UsageChartProps
 */

/**
 * @param {UsageChartProps} props
 */
export function UsageChart({ days, format }) {
  const max = Math.max(...days.map((day) => day.spentCents), 0);
  const lastIndex = days.length - 1;

  return (
    <figure className={styles.figure}>
      <div className={styles.plot} aria-hidden="true">
        {days.map((day, index) => {
          const height = max > 0 ? Math.max(2, Math.round((day.spentCents / max) * 100)) : 2;
          const label = `${dayLabel(day.day, index === lastIndex)}: ${format(day.spentCents)} · ${tasksLabel(day.tasks)}`;
          return (
            <div key={day.day} className={styles.column}>
              <div className={styles.slot}>
                <span
                  className={day.spentCents > 0 ? styles.bar : `${styles.bar} ${styles.empty}`}
                  style={{ height: `${height}%` }}
                />
                <span className={styles.tip}>{label}</span>
              </div>
              <span className={styles.tick}>{index === lastIndex ? "hoje" : shortDay(day.day)}</span>
            </div>
          );
        })}
      </div>
      <table className={styles.visuallyHidden}>
        <caption>Uso de cada dia, dos últimos {days.length} dias</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Uso</th>
            <th scope="col">Tarefas</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, index) => (
            <tr key={day.day}>
              <th scope="row">{dayLabel(day.day, index === lastIndex)}</th>
              <td>{format(day.spentCents)}</td>
              <td>{day.tasks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** "2026-11-16" → "16/11". */
function shortDay(isoDay) {
  const [, month, day] = isoDay.split("-");
  return `${day}/${month}`;
}

function dayLabel(isoDay, isToday) {
  return isToday ? `Hoje (${shortDay(isoDay)})` : shortDay(isoDay);
}

function tasksLabel(count) {
  return count === 1 ? "1 tarefa" : `${count} tarefas`;
}
