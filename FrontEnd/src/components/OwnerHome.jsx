// Painel do dono (etapa 5): no alto, o crédito da empresa; depois a equipe, com o gasto do mês de cada pessoa, o resumo
// do que fez e as entregas ("Ver o que fez"); o convite de funcionários; e o extrato do mês, com as recargas. O dono vê
// o que cada um fez e quanto custou, nunca os pedidos, as respostas nem as conversas (F05; decisão 2 de 24/10/2026).

import { firstName } from "../lib/auth/member.js";
import { emptyMonth, STATEMENT_PAGE_SIZE } from "../lib/ock/statement.js";
import { deadlineText } from "../lib/ock/deadline.js";

import { budgetInputValue } from "../lib/ock/team-forms.js";
import { formatBRL } from "../lib/ock/pricing.js";
import { CompanyAgents } from "./CompanyAgents.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { CompanyCredit } from "./CompanyCredit.jsx";
import { DemoRecharge } from "./DemoRecharge.jsx";
import { InviteEmployee } from "./InviteEmployeeForm.jsx";
import { MemberActions } from "./MemberActions.jsx";
import { MemberMonth } from "./MemberMonth.jsx";
import { MonthStory } from "./MonthStory.jsx";
import { StatementList } from "./StatementList.jsx";
import styles from "./OwnerHome.module.css";

/**
 * @typedef {{
 * me: CurrentMember;
 * team: TeamMember[];
 * credit: Credit;
 * // O mês de cada pessoa da equipe, pelo id.
 * months: ReadonlyMap<string, Month>;
 * // O extrato do mês da empresa (as linhas mais recentes) e se há mais.
 * statement: { lines: StatementLine[]; more: boolean };
 * // Os agentes prontos que a empresa criou (Fase 2).
 * agents: CompanyAgentCard[];
 * // Na visão raio-x (só no computador), mostra a recarga de teste. Em produção é sempre falso.
 * demo: boolean;
 * }} OwnerHomeProps
 */

/** A etiqueta e a frase do convite que a pessoa ainda não usou. Quem foi desativado não mostra convite. */
function inviteInfo(person) {
  const invite = person.invite;
  if (!invite || person.status !== "active") return null;
  if (invite.kind === "invite") {
    return invite.expired
      ? { tag: "Convite vencido", note: "O convite venceu antes de ser aceito. Gere um link novo e mande de novo." }
      : {
          tag: "Convite pendente",
          note: `O convite vale até ${deadlineText(invite.expiresAt)}. Se a pessoa perdeu o link, gere um novo.`,
        };
  }
  if (invite.expired) return null;
  return {
    tag: "Senha nova pendente",
    note: `O link de senha nova vale até ${deadlineText(invite.expiresAt)}. Até ele ser usado, a senha antiga continua valendo.`,
  };
}

/**
 * @param {OwnerHomeProps} props
 */
export function OwnerHome({ me, team, credit, months, statement, agents, demo }) {
  const people = new Map(team.map((person) => [person.id, person.name]));
  // Para o painel de custo total: o que entrou em créditos neste mês (as recargas do extrato) e quantas execuções a
  // equipe fez (as contas do mês de cada pessoa, feitas no banco).
  const topupCents = statement.lines
    .filter((line) => line.kind === "topup")
    .reduce((total, line) => total + line.amountCents, 0);
  const runs = [...months.values()].reduce((total, month) => total + month.quickTasks + month.recipes, 0);
  const deliveries = [...months.values()].reduce((total, month) => total + month.deliveries, 0);
  // Quem mais gastou no mês, para a história do mês.
  const topMonth = [...months.values()].reduce((top, month) => (top && top.spentCents >= month.spentCents ? top : month), null);
  const topPerson =
    topMonth && topMonth.spentCents > 0 && people.has(topMonth.memberId)
      ? { name: people.get(topMonth.memberId), spentCents: topMonth.spentCents }
      : null;
  return (
    <main className={styles.main}>
      <PageHeader
        eyebrow="Painel do dono"
        title={`${me.companyName},`}
        titleEm="o mês da sua equipe."
        lead={`Olá, ${firstName(me.name)}. O que cada pessoa entregou, quanto gastou e quanto ainda há de crédito.`}
        stats={[
          { label: "Disponível", value: formatBRL(Math.max(0, credit.availableCents)) },
          { label: "Gasto no mês", value: formatBRL(credit.monthSpentCents) },
          { label: "Entregas", value: String(deliveries) },
        ]}
      />

      <MonthStory
        credit={credit}
        topupCents={topupCents}
        topupPartial={statement.more}
        runs={runs}
        deliveries={deliveries}
        topPerson={topPerson}
      />

      <CompanyCredit credit={credit} topupCents={topupCents} topupPartial={statement.more} runs={runs} />

      {demo && (
        <section className={styles.section} aria-labelledby="demo-topup-title">
          <h2 id="demo-topup-title" className={styles.sectionTitle}>
            Recarga de teste
          </h2>
          <p className={styles.sectionLead}>
            Só no computador, na visão raio-x: adiciona crédito fictício na empresa para você testar à vontade. Não
            existe no site publicado.
          </p>
          <DemoRecharge ownerId={me.id} />
        </section>
      )}

      <section className={styles.section} aria-labelledby="team-title">
        <h2 id="team-title" className={styles.sectionTitle}>
          Equipe <span className={styles.count}>({team.length})</span>
        </h2>
        <ul className={styles.team}>
          {team.map((person) => {
            const invite = inviteInfo(person);
            return (
              <li key={person.id} className={styles.person}>
                <div className={styles.personTop}>
                  <div className={styles.personMain}>
                    <p className={styles.personName}>
                      {person.name}
                      {person.id === me.id && <span className={styles.you}> (você)</span>}
                    </p>
                    <p className={styles.personEmail}>{person.email}</p>
                  </div>
                  <ul className={styles.tags} aria-label="Detalhes">
                    <li className={styles.tag}>{person.role === "owner" ? "Dono" : "Funcionário"}</li>
                    {invite && <li className={styles.tagWarning}>{invite.tag}</li>}
                    {person.status === "disabled" && <li className={styles.tagMuted}>Desativado</li>}
                  </ul>
                </div>
                {invite && <p className={styles.personNote}>{invite.note}</p>}
                <MemberMonth
                  memberId={person.id}
                  name={person.name}
                  month={months.get(person.id) ?? emptyMonth(person.id)}
                  budgetCents={person.monthlyBudgetCents}
                  companyAvailableCents={credit.availableCents}
                />
                {person.role === "employee" && (
                  <MemberActions
                    ownerId={me.id}
                    memberId={person.id}
                    name={person.name}
                    status={person.status}
                    budgetInput={budgetInputValue(person.monthlyBudgetCents)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="invite-title">
        <h2 id="invite-title" className={styles.sectionTitle}>
          Criar um funcionário
        </h2>
        <p className={styles.sectionLead}>
          Você cria o login da pessoa: informe o nome, o e-mail e o teto. O sistema gera uma senha temporária para você
          entregar a ela; no primeiro acesso ela cria a própria senha.
        </p>
        <InviteEmployee ownerId={me.id} />
      </section>

      <section className={styles.section} aria-labelledby="agents-title">
        <h2 id="agents-title" className={styles.sectionTitle}>
          Agentes da empresa <span className={styles.count}>({agents.length})</span>
        </h2>
        <p className={styles.sectionLead}>
          Crie assistentes de IA próprios da sua empresa. Eles aparecem na aba Receitas da equipe, ao lado dos agentes
          prontos, e respondem do jeito que você definir.
        </p>
        <CompanyAgents ownerId={me.id} agents={agents} />
      </section>

      <section className={styles.section} aria-labelledby="statement-title">
        <h2 id="statement-title" className={styles.sectionTitle}>
          Extrato do mês
        </h2>
        <p className={styles.sectionLead}>
          As recargas e os gastos da empresa neste mês, com quem gastou. É aqui que você confere se o Pix entrou.
        </p>
        {statement.lines.length === 0 ? (
          <p className={styles.personNote}>Nenhum movimento neste mês ainda.</p>
        ) : (
          <StatementList lines={statement.lines} label="Extrato do mês" people={people} />
        )}
        {statement.more && (
          <p className={styles.personNote}>Mostrando os {STATEMENT_PAGE_SIZE} movimentos mais recentes.</p>
        )}
      </section>
    </main>
  );
}
