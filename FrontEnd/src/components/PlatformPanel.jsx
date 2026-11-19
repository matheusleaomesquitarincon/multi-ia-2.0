// O painel interno da plataforma (bloco 3), só para a equipe: o custo real das IAs contra o cobrado no mês, as empresas
// com o saldo de cada uma, a recarga pela tela, o câmbio e o extrato de recargas. Quem confere quem é da equipe é o
// servidor e o banco; aqui só se mostra o que veio.

import { useActionState } from "react";
import { platformExchangeAction, platformTopupAction } from "../lib/actions.js";
import { formatBRL } from "../lib/ock/pricing.js";
import { formatDateTime } from "../lib/ock/statement.js";
import { PageHeader } from "./PageHeader.jsx";
import forms from "./TeamForms.module.css";
import styles from "./PlatformPanel.module.css";

const INITIAL = { status: "idle" };

/**
 * @param {{ data: any }} props
 */
export function PlatformPanel({ data }) {
  const { costs, companies, entries, exchange, log, staffName } = data;
  const margin = costs.total.billedCents - costs.total.costCents;

  return (
    <main className={styles.main}>
      <PageHeader
        eyebrow="Plataforma · uso interno"
        title={`Olá, ${staffName}.`}
        titleEm="Como está a casa?"
        lead="Tudo o que acontece em todas as empresas: o que as IAs custaram para nós, o que cobramos, o saldo de cada empresa e as recargas."
        stats={[
          { label: "Empresas", value: companies.length },
          { label: "Custo das IAs no mês", value: formatBRL(costs.total.costCents), note: formatUsd(costs.total.costUsd) },
          { label: "Cobrado no mês", value: formatBRL(costs.total.billedCents) },
          { label: "Câmbio", value: `R$ ${formatRate(exchange.usdToBrl)}` },
        ]}
      />

      <section className={styles.section} aria-labelledby="costs-title">
        <h2 id="costs-title" className={styles.sectionTitle}>
          Custo real das IAs contra o cobrado
        </h2>
        <p className={styles.sectionLead}>
          Desde {formatDateTime(costs.from)}. O custo real vem de cada chamada às IAs, no câmbio daquela chamada; as
          tentativas que falharam nós pagamos, mas não cobramos. Diferença ={" "}
          <strong className={margin < 0 ? styles.negative : undefined}>{formatBRL(margin)}</strong>.
        </p>
        {costs.rows.length === 0 ? (
          <p className={styles.empty}>Nenhuma chamada às IAs neste mês.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Chamadas</th>
                  <th scope="col">Custo real</th>
                  <th scope="col">Das falhas</th>
                  <th scope="col">Cobrado</th>
                  <th scope="col">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {costs.rows.map((row) => (
                  <CostRow key={row.companyId} name={row.companyName} row={row} />
                ))}
              </tbody>
              <tfoot>
                <CostRow name="Total" row={costs.total} />
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="companies-title">
        <h2 id="companies-title" className={styles.sectionTitle}>
          Empresas <span className={styles.count}>{companies.length}</span>
        </h2>
        {companies.length === 0 ? (
          <p className={styles.empty}>Nenhuma empresa cadastrada ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Dono</th>
                  <th scope="col">Pessoas</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Disponível</th>
                  <th scope="col">Gasto no mês</th>
                  <th scope="col">Último movimento</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <th scope="row">{company.name}</th>
                    <td>
                      {company.ownerName ?? "—"}
                      {company.ownerEmail && <span className={styles.sub}>{company.ownerEmail}</span>}
                    </td>
                    <td>{company.activeMembers}</td>
                    <td className={company.balanceCents < 0 ? styles.negative : undefined}>
                      {formatBRL(company.balanceCents)}
                    </td>
                    <td>{formatBRL(company.availableCents)}</td>
                    <td>{formatBRL(company.monthSpentCents)}</td>
                    <td>{company.lastActivityAt ? formatDateTime(company.lastActivityAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={styles.columns}>
        <TopupForm companies={companies} />
        <ExchangeForm exchange={exchange} />
      </div>

      <section className={styles.section} aria-labelledby="entries-title">
        <h2 id="entries-title" className={styles.sectionTitle}>
          Extrato de recargas
        </h2>
        <p className={styles.sectionLead}>As 50 recargas e ajustes mais recentes de todas as empresas.</p>
        {entries.length === 0 ? (
          <p className={styles.empty}>Nenhuma recarga ainda.</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  <strong>{entry.companyName}</strong>
                  <span className={styles.sub}>
                    {entry.kind === "topup" ? "Recarga" : "Ajuste"} · {entry.description}
                  </span>
                </span>
                <span className={styles.listSide}>
                  <span className={entry.amountCents < 0 ? styles.negative : styles.positive}>
                    {entry.amountCents > 0 ? "+" : ""}
                    {formatBRL(entry.amountCents)}
                  </span>
                  <span className={styles.sub}>{formatDateTime(entry.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="log-title">
        <h2 id="log-title" className={styles.sectionTitle}>
          O que a equipe fez
        </h2>
        {log.length === 0 ? (
          <p className={styles.empty}>Nada ainda pelo painel.</p>
        ) : (
          <ul className={styles.list}>
            {log.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  <strong>{item.staffName}</strong>
                  <span className={styles.sub}>{describeLog(item, companies)}</span>
                </span>
                <span className={styles.sub}>{formatDateTime(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CostRow({ name, row }) {
  const difference = row.billedCents - row.costCents;
  return (
    <tr>
      <th scope="row">{name}</th>
      <td>
        {row.calls}
        {row.failedCalls > 0 && <span className={styles.sub}>{row.failedCalls} falharam</span>}
      </td>
      <td>
        {formatBRL(row.costCents)}
        <span className={styles.sub}>{formatUsd(row.costUsd)}</span>
      </td>
      <td>{formatBRL(row.failedCostCents)}</td>
      <td>{formatBRL(row.billedCents)}</td>
      <td className={difference < 0 ? styles.negative : undefined}>{formatBRL(difference)}</td>
    </tr>
  );
}

function TopupForm({ companies }) {
  const [state, formAction, pending] = useActionState(platformTopupAction, INITIAL);

  // Recarga mexe em dinheiro: pergunta antes, com a empresa e o valor por extenso.
  function confirmTopup(event) {
    const form = new FormData(event.currentTarget);
    const company = companies.find((item) => item.id === form.get("companyId"));
    const amount = String(form.get("amount") ?? "").trim();
    if (!company || !amount) return;
    if (!window.confirm(`Recarregar R$ ${amount} em ${company.name}?`)) event.preventDefault();
  }

  return (
    <section className={styles.card} aria-labelledby="topup-title">
      <h2 id="topup-title" className={styles.cardTitle}>
        Recarregar uma empresa
      </h2>
      <p className={styles.sectionLead}>Só depois de o pagamento cair. A recarga entra no extrato e não se desfaz.</p>
      <form action={formAction} onSubmit={confirmTopup} className={forms.stack}>
        <div className={forms.field}>
          <label htmlFor="topup-company" className={forms.label}>
            Empresa
          </label>
          <select id="topup-company" name="companyId" className={forms.input} defaultValue="" required>
            <option value="" disabled>
              Escolha a empresa
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className={forms.field}>
          <label htmlFor="topup-amount" className={forms.label}>
            Valor (R$)
          </label>
          <input id="topup-amount" name="amount" className={forms.input} inputMode="decimal" placeholder="200,00" />
        </div>
        <div className={forms.field}>
          <label htmlFor="topup-description" className={forms.label}>
            De onde veio
          </label>
          <input
            id="topup-description"
            name="description"
            className={forms.input}
            maxLength={120}
            placeholder="Pix de 18/11"
          />
          <p className={forms.hint}>A empresa lê isso no extrato dela.</p>
        </div>
        <FormMessage state={state} />
        <div className={forms.buttons}>
          <button type="submit" className={forms.primaryButton} disabled={pending || companies.length === 0}>
            {pending ? "Recarregando…" : "Recarregar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ExchangeForm({ exchange }) {
  const [state, formAction, pending] = useActionState(platformExchangeAction, INITIAL);
  return (
    <section className={styles.card} aria-labelledby="exchange-title">
      <h2 id="exchange-title" className={styles.cardTitle}>
        Câmbio
      </h2>
      <p className={styles.sectionLead}>
        Quantos reais custa cada dólar que pagamos às IAs (com o IOF e a taxa do cartão). Vale para os próximos usos; o
        que já foi cobrado não muda.
        {exchange.updatedAt && <> Última mudança: {formatDateTime(exchange.updatedAt)}.</>}
      </p>
      <form action={formAction} className={forms.stack}>
        <div className={forms.field}>
          <label htmlFor="exchange-rate" className={forms.label}>
            Reais por dólar
          </label>
          <input
            key={exchange.usdToBrl}
            id="exchange-rate"
            name="rate"
            className={forms.input}
            inputMode="decimal"
            defaultValue={formatRate(exchange.usdToBrl)}
          />
          <p className={forms.hint}>Entre R$ 1 e R$ 20, com até 4 casas.</p>
        </div>
        <FormMessage state={state} />
        <div className={forms.buttons}>
          <button type="submit" className={forms.primaryButton} disabled={pending}>
            {pending ? "Salvando…" : "Salvar o câmbio"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormMessage({ state }) {
  if (state.status === "error") {
    return (
      <p className={forms.error} role="alert">
        {state.message}
      </p>
    );
  }
  if (state.status === "done") {
    return (
      <p className={styles.done} role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

function describeLog(item, companies) {
  if (item.action === "exchange") return `Mudou o câmbio para R$ ${formatRate(item.usdToBrl)}`;
  const company = companies.find((entry) => entry.id === item.companyId)?.name ?? "uma empresa";
  return `Recarregou ${formatBRL(item.amountCents)} em ${company} · ${item.details}`;
}

function formatRate(rate) {
  return Number(rate).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatUsd(usd) {
  return `US$ ${Number(usd).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}
