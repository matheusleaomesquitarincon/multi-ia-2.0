// A aba "Meu time" do espaço de trabalho (F08): o dia de trabalho da pessoa e os times de IA dela.
// - No alto, o dia: quanto usou hoje, quantas tarefas fez, o que está pendente e o uso dos últimos 14 dias em barras.
// - Pendências: receitas paradas esperando a pessoa (pausadas) ou ainda trabalhando, com "Abrir" para acompanhar.
// - Tarefas recentes: as últimas receitas rodadas e como terminaram, com Apagar (F64).
// - Meus times de IA: as receitas próprias, desenhadas como uma linha de trabalho (quem passa para quem), com Usar,
//   Mudar e Apagar, e o "Montar um time" (components/TeamEditor.jsx).
// - Sua conta (só funcionário): "Apagar minha conta", digitando APAGAR para confirmar (F64, LGPD).
// Os números vêm de /api/ock/my-day, buscados cada vez que a aba abre.

import { Fragment, useCallback, useEffect, useState } from "react";

import { deleteAccount, deleteCustomRecipe, deleteRun, loadMyDay } from "../lib/ock/chat-client.js";
import { formatBRL, formatCredits } from "../lib/ock/pricing.js";
import { formatDateTime } from "../lib/ock/statement.js";
import { CUSTOM_RECIPE_PREFIX } from "../lib/recipes/custom-form.js";
import { forgetActiveRun, recallActiveRun } from "../lib/runs/active-run.js";
import { AiDot } from "./AiDot.jsx";
import { TeamEditor } from "./TeamEditor.jsx";
import { UsageChart } from "./UsageChart.jsx";
import styles from "./MyTeam.module.css";

/** Como cada situação de uma receita aparece, e a cor da etiqueta. */
const STATUS = {
  queued: { label: "Na fila", tone: "working" },
  running: { label: "Trabalhando", tone: "working" },
  paused: { label: "Pausada: espera você", tone: "warning" },
  finished: { label: "Concluída", tone: "done" },
  failed: { label: "Não terminou", tone: "error" },
  cancelled: { label: "Cancelada", tone: "waiting" },
};

/**
 * @typedef {WorkspaceRecipe & { mine: boolean; form: CustomRecipeForm }} CustomTeam
 */

/**
 * @typedef {{
 * pageMemberId: string;
 * isOwner: boolean;
 * teams: CustomTeam[];
 * // Os ids das receitas que a tela sabe abrir (as prontas e os times), para o "Abrir" das pendências.
 * openableRecipeIds: string[];
 * onUseRecipe: (recipeId: string) => void;
 * onOpenRun: (recipeId: string, runId: string) => void;
 * // Um time foi salvo, mudado ou apagado: o espaço de trabalho busca a lista de novo.
 * onTeamsChange: () => Promise<void>;
 * }} MyTeamProps
 */

/**
 * @param {MyTeamProps} props
 */
export function MyTeam({ pageMemberId, isOwner, teams, openableRecipeIds, onUseRecipe, onOpenRun, onTeamsChange }) {
  const [day, setDay] = useState({ state: "loading" });
  // null: a lista dos times; "new": montando um time; um time: mudando esse time.
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const format = isOwner ? formatBRL : formatCredits;

  const reload = useCallback(() => {
    void loadMyDay().then((result) => {
      setDay(result.ok ? { state: "ready", data: result.data } : { state: "error", problem: result.problem });
    });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  async function removeTeam(team) {
    const confirmed = window.confirm(
      `Apagar o time “${team.name}”? As receitas que já rodaram com ele continuam no histórico.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setProblem(null);
    const result = await deleteCustomRecipe(team.id.slice(CUSTOM_RECIPE_PREFIX.length), pageMemberId);
    if (result.ok) await onTeamsChange();
    else setProblem(result.problem);
    setBusy(false);
  }

  async function removeRun(run) {
    const confirmed = window.confirm(
      `Apagar “${run.name}” de ${formatDateTime(run.createdAt)}? O pedido, as etapas e o resultado somem para sempre. ` +
        "O que foi entregue continua na aba Entregas, e o gasto continua no extrato.",
    );
    if (!confirmed) return;
    setBusy(true);
    setProblem(null);
    const result = await deleteRun(run.id, pageMemberId);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    // A receita não tenta mais acompanhar a execução que sumiu.
    if (recallActiveRun(run.recipeId) === run.id) forgetActiveRun(run.recipeId);
    reload();
  }

  async function saved() {
    await onTeamsChange();
    setEditing(null);
  }

  return (
    <div className={styles.page}>
      <DaySection day={day} format={format} />

      {day.state === "ready" && (
        <RunsSection
          pending={day.data.pending}
          recent={day.data.recent}
          openable={openableRecipeIds}
          busy={busy}
          onOpenRun={onOpenRun}
          onDeleteRun={(run) => void removeRun(run)}
        />
      )}

      {problem && editing === null && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      <section className={styles.section} aria-labelledby="meus-times">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="meus-times" className={styles.sectionTitle}>
              Meus times de IA
            </h2>
            <p className={styles.lead}>
              Monte o seu próprio time: escolha quem trabalha, com qual IA e o que cada um faz. Ele fica salvo para usar
              de novo, só para você ou para a empresa toda.
            </p>
          </div>
          {editing === null && (
            <button type="button" className={styles.primary} onClick={() => setEditing("new")}>
              + Montar um time
            </button>
          )}
        </div>

        {editing !== null ? (
          <TeamEditor
            pageMemberId={pageMemberId}
            editing={
              editing === "new" ? null : { id: editing.id.slice(CUSTOM_RECIPE_PREFIX.length), form: editing.form }
            }
            onSaved={() => void saved()}
            onCancel={() => setEditing(null)}
          />
        ) : teams.length === 0 ? (
          <div className={styles.empty}>
            <p>
              Você ainda não montou nenhum time. Um time é como uma receita pronta, mas do seu jeito: por exemplo, um
              Pesquisador que levanta o assunto, um Redator que escreve e um Revisor que confere.
            </p>
          </div>
        ) : (
          <ul className={styles.teams}>
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                canChange={team.mine || (isOwner && team.form.visibility === "company")}
                busy={busy}
                onUse={() => onUseRecipe(team.id)}
                onEdit={() => setEditing(team)}
                onDelete={() => void removeTeam(team)}
              />
            ))}
          </ul>
        )}
      </section>

      {!isOwner && <AccountSection pageMemberId={pageMemberId} />}
    </div>
  );
}

/** "Apagar minha conta": abre uma confirmação em que a pessoa digita APAGAR. */
function AccountSection({ pageMemberId }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState(null);

  async function confirm(event) {
    event.preventDefault();
    if (deleting) return;
    setDeleting(true);
    setProblem(null);
    const result = await deleteAccount(typed, pageMemberId);
    if (!result.ok) {
      setDeleting(false);
      setProblem(result.problem);
      return;
    }
    // A conta não existe mais: volta para a página inicial, já sem login.
    window.location.assign("/");
  }

  return (
    <section className={styles.section} aria-labelledby="sua-conta">
      <h2 id="sua-conta" className={styles.sectionTitle}>
        Sua conta
      </h2>
      {!open ? (
        <div className={styles.account}>
          <p className={styles.muted}>
            Você pode apagar a sua conta quando quiser. Apagar uma conversa, uma entrega ou uma receita rodada é no
            próprio item.
          </p>
          <button type="button" className={styles.danger} onClick={() => setOpen(true)}>
            Apagar minha conta
          </button>
        </div>
      ) : (
        <form className={styles.accountConfirm} onSubmit={(event) => void confirm(event)}>
          <p>
            <strong>Isto não tem volta.</strong> Somem as suas conversas, os arquivos que você anexou, as receitas que
            você rodou, as suas pastas, os times que só você usa e o seu login. O seu e-mail fica livre.
          </p>
          <p>
            Ficam com a empresa: as entregas (os documentos que as IAs fizeram, que o dono já vê), os times deixados para
            a empresa toda e o extrato com o que você gastou.
          </p>
          <label className={styles.accountField}>
            <span>Para confirmar, digite APAGAR</span>
            <input
              className={styles.accountInput}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </label>
          {problem && (
            <p className={styles.problem} role="alert">
              {problem}
            </p>
          )}
          <div className={styles.teamActions}>
            <button
              type="submit"
              className={styles.dangerSolid}
              disabled={deleting || typed.trim().toUpperCase() !== "APAGAR"}
            >
              {deleting ? "Apagando…" : "Apagar minha conta"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)} disabled={deleting}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function DaySection({ day, format }) {
  if (day.state === "loading") {
    return <p className={styles.muted}>Carregando o seu dia…</p>;
  }
  if (day.state === "error") {
    return (
      <p className={styles.problem} role="alert">
        {day.problem}
      </p>
    );
  }
  const { days, pending } = day.data;
  const today = days.at(-1) ?? { spentCents: 0, tasks: 0 };
  const total = days.reduce((sum, item) => sum + item.spentCents, 0);
  const waiting = pending.filter((run) => run.status === "paused").length;

  return (
    <section className={styles.section} aria-labelledby="meu-dia">
      <h2 id="meu-dia" className={styles.sectionTitle}>
        Seu dia
      </h2>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Usado hoje</dt>
          <dd>{format(today.spentCents)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Tarefas hoje</dt>
          <dd>{today.tasks}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Pendências</dt>
          <dd>
            {pending.length}
            {waiting > 0 && <span className={styles.statNote}> · {waiting} esperando você</span>}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Últimos {days.length} dias</dt>
          <dd>{format(total)}</dd>
        </div>
      </dl>
      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Uso por dia</h3>
        <UsageChart days={days} format={format} />
      </div>
    </section>
  );
}

function RunsSection({ pending, recent, openable, busy, onOpenRun, onDeleteRun }) {
  const canOpen = (run) => openable.includes(run.recipeId);
  return (
    <div className={styles.columns}>
      <section className={styles.section} aria-labelledby="pendencias">
        <h2 id="pendencias" className={styles.sectionTitle}>
          Pendências
        </h2>
        {pending.length === 0 ? (
          <p className={styles.muted}>Nada pendente. Tudo o que você pediu já terminou.</p>
        ) : (
          <ul className={styles.runs}>
            {pending.map((run) => (
              <RunRow key={run.id} run={run} onOpen={canOpen(run) ? () => onOpenRun(run.recipeId, run.id) : null} />
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section} aria-labelledby="recentes">
        <h2 id="recentes" className={styles.sectionTitle}>
          Tarefas recentes
        </h2>
        {recent.length === 0 ? (
          <p className={styles.muted}>Nenhuma receita rodada ainda.</p>
        ) : (
          <ul className={styles.runs}>
            {recent.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                busy={busy}
                onOpen={canOpen(run) ? () => onOpenRun(run.recipeId, run.id) : null}
                onDelete={() => onDeleteRun(run)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RunRow({ run, busy = false, onOpen, onDelete }) {
  const status = STATUS[run.status] ?? { label: run.status, tone: "waiting" };
  return (
    <li className={styles.run}>
      <div className={styles.runInfo}>
        <span className={styles.runName}>{run.name}</span>
        <span className={styles.runDate}>{formatDateTime(run.createdAt)}</span>
      </div>
      <span className={`${styles.badge} ${styles[status.tone]}`}>{status.label}</span>
      {onOpen && (
        <button type="button" className={styles.link} onClick={onOpen}>
          Abrir<span className={styles.visuallyHidden}> {run.name}</span>
        </button>
      )}
      {onDelete && (
        <button type="button" className={styles.danger} onClick={onDelete} disabled={busy}>
          Apagar<span className={styles.visuallyHidden}> {run.name}</span>
        </button>
      )}
    </li>
  );
}

function TeamCard({ team, canChange, busy, onUse, onEdit, onDelete }) {
  return (
    <li className={styles.team}>
      <div className={styles.teamHead}>
        <h3 className={styles.teamName}>{team.name}</h3>
        <span className={styles.visibility}>{team.form.visibility === "company" ? "Empresa toda" : "Só você"}</span>
      </div>
      <ol className={styles.flow} aria-label={`A ordem do time ${team.name}`}>
        {team.form.members.map((member, index) => (
          <Fragment key={`${member.name}-${index}`}>
            {index > 0 && (
              <li className={styles.flowArrow} aria-hidden="true">
                →
              </li>
            )}
            <li className={styles.flowStep}>
              <AiDot provider={member.provider} />
              <span>{member.name}</span>
            </li>
          </Fragment>
        ))}
      </ol>
      <div className={styles.teamActions}>
        <button type="button" className={styles.primary} onClick={onUse} disabled={busy}>
          Usar<span className={styles.visuallyHidden}> o time {team.name}</span>
        </button>
        {canChange && (
          <>
            <button type="button" className={styles.secondary} onClick={onEdit} disabled={busy}>
              Mudar<span className={styles.visuallyHidden}> o time {team.name}</span>
            </button>
            <button type="button" className={styles.danger} onClick={onDelete} disabled={busy}>
              Apagar<span className={styles.visuallyHidden}> o time {team.name}</span>
            </button>
          </>
        )}
      </div>
    </li>
  );
}
