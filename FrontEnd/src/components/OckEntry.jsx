// A porta de entrada do OCK, para quem ainda não entrou. Visual editorial (11/11/2026): um herói com o produto ao lado,
// as IAs, as receitas, o "como funciona" numa faixa escura, o que o dono acompanha, as dúvidas e o fechamento. No fim,
// as mesmas portas de sempre: o dono cria a conta da empresa; quem já tem conta (dono ou funcionário) entra. O
// funcionário não se cadastra sozinho: o acesso vem por convite do dono.
// Os painéis são ilustrações com dados de exemplo, nunca dados de uma empresa de verdade.

import { Link } from "react-router";
import { AiDot } from "./AiDot.jsx";
import { Reveal } from "./Reveal.jsx";
import styles from "./OckEntry.module.css";

/** O painel do herói: uma receita trabalhando, como aparece para o funcionário. */
function HeroMockup() {
  return (
    <div className={styles.mockupWrap} aria-hidden="true">
      <div className={styles.mockupBack} />
      <div className={styles.mockup}>
        <div className={styles.mockupHead}>
          <span className={styles.mockupTitle}>Proposta comercial · Padaria Sol</span>
          <span className={styles.live}>
            <span className={styles.liveDot} /> trabalhando
          </span>
        </div>
        <ul className={styles.mockupRows}>
          <li className={styles.mockupRow}>
            <AiDot provider="claude" />
            <span className={styles.rowRole}>Consultor</span>
            <span className={styles.rowAi}>Claude</span>
            <span className={styles.tagDone}>concluído</span>
          </li>
          <li className={styles.mockupRow}>
            <AiDot provider="gpt" />
            <span className={styles.rowRole}>Redator</span>
            <span className={styles.rowAi}>GPT</span>
            <span className={styles.tagWorking}>escrevendo</span>
          </li>
          <li className={styles.mockupRow}>
            <AiDot provider="claude" />
            <span className={styles.rowRole}>Cliente exigente</span>
            <span className={styles.rowAi}>Claude</span>
            <span className={styles.tagWaiting}>na fila</span>
          </li>
        </ul>
        <div className={styles.mockupFoot}>
          <span>Reservado: até R$ 0,42</span>
          <span className={styles.mockupFootStrong}>Gasto até agora: R$ 0,09</span>
        </div>
      </div>
      <p className={`${styles.chip} ${styles.chipTop}`}>
        <span className={styles.chipDotDone} /> Word pronto para baixar
      </p>
      <p className={`${styles.chip} ${styles.chipBottom}`}>
        <span className={styles.chipDotWarn} /> Ana usou 82% do teto do mês
      </p>
    </div>
  );
}

const AIS = [
  { provider: "claude", name: "Claude", by: "Anthropic" },
  { provider: "gpt", name: "GPT", by: "OpenAI" },
  { provider: "gemini", name: "Gemini", by: "Google" },
];

const RECIPES = [
  {
    name: "Criar um site",
    text: "Um chefe planeja, um pesquisador busca ideias, dois programadores constroem e o chefe revisa.",
    team: ["claude", "gemini", "gpt", "claude"],
    out: "Site",
  },
  {
    name: "Proposta comercial",
    text: "Um consultor planeja, um redator escreve e um cliente exigente critica antes de ir para o cliente.",
    team: ["claude", "gpt", "claude"],
    out: "Word",
  },
  {
    name: "Posts para redes sociais",
    text: "Dois redatores de IAs diferentes escrevem ao mesmo tempo e um editor escolhe o melhor de cada.",
    team: ["claude", "gpt", "claude", "gpt"],
    out: "Texto",
  },
  {
    name: "Relatório mensal",
    text: "Um analista organiza os números, um redator escreve e um conferente checa cada número.",
    team: ["claude", "gpt", "claude"],
    out: "Word",
  },
];

const STEPS = [
  {
    title: "O funcionário pede",
    text: "Em português, do jeito que falaria com um colega. Escolhe uma receita pronta ou faz uma pergunta rápida no chat.",
  },
  {
    title: "O time trabalha, à vista",
    text: "A plataforma recomenda a IA de cada papel, e dá para trocar. O custo máximo aparece antes de começar, e cada etapa pode ser acompanhada ao vivo.",
  },
  {
    title: "A entrega fica guardada",
    text: "Word, PDF, planilha, gráfico ou site, pronto para baixar. Se uma IA falhar, outra assume, e etapa que falhou não é cobrada.",
  },
];

const TEAM_TABLE = [
  { name: "Ana Lima", deliveries: 14, spent: "R$ 41,20", status: "watch", label: "82% do teto" },
  { name: "Bruno Costa", deliveries: 9, spent: "R$ 12,80", status: "clear", label: "dentro do teto" },
  { name: "Carla Souza", deliveries: 21, spent: "R$ 30,00", status: "flag", label: "teto atingido" },
  { name: "Diego Reis", deliveries: 6, spent: "R$ 7,45", status: "clear", label: "dentro do teto" },
];

const FAQ = [
  {
    q: "Preciso ter conta no ChatGPT, no Claude ou no Gemini?",
    a: "Não. A empresa usa as três IAs pela plataforma, sem chave de API e sem assinatura em cada uma. Tudo é pago em reais, pelo consumo.",
  },
  {
    q: "O dono consegue ler as conversas dos funcionários?",
    a: "Não. O dono vê o que cada pessoa entregou, quanto gastou e em qual IA. As conversas continuam sendo de quem conversou.",
  },
  {
    q: "E se o gasto sair do controle?",
    a: "Cada funcionário tem um teto de gasto no mês, definido pelo dono. Antes de cada receita aparece o máximo que ela pode custar, e o time pausa e pergunta se for passar dele.",
  },
  {
    q: "Quem escolhe qual IA faz cada coisa?",
    a: "A plataforma recomenda a IA, o nível do modelo e o esforço. O funcionário pode trocar quando quiser, inclusive no chat.",
  },
  {
    q: "O que acontece se uma IA falhar no meio?",
    a: "Ela tenta de novo e, se não der, outra IA assume o papel, com aviso. Se ainda assim não der, o trabalho pausa sem perder nada, e a etapa que falhou não é cobrada.",
  },
];

/**
 * @param {{ demo: boolean }} props
 */
export function OckEntry({ demo }) {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} /> Para pequenas e médias empresas
          </p>
          <h1 className={styles.title}>
            O time de IAs da sua empresa, <em className={styles.titleEm}>com o dono no controle.</em>
          </h1>
          <p className={styles.lead}>
            Os funcionários usam Claude, GPT e Gemini no trabalho do dia a dia, sozinhos ou em times prontos. O dono
            acompanha o que cada um entregou e quanto gastou, com um teto para cada pessoa.
          </p>
          <div className={styles.heroActions}>
            <Link to="/cadastro" className={styles.primaryButton}>
              Criar a conta da empresa
            </Link>
            <a href="#como-funciona" className={styles.textLink}>
              Ver como funciona →
            </a>
          </div>
          <p className={styles.fineprint}>Sem chave de API · preço em reais · tudo em português</p>
        </div>
        <HeroMockup />
      </section>

      <section className={styles.aiStrip} aria-labelledby="ais-title">
        <p id="ais-title" className={styles.stripLabel}>
          Os melhores modelos, num lugar só
        </p>
        <ul className={styles.aiList}>
          {AIS.map((ai) => (
            <li key={ai.provider} className={styles.aiItem}>
              <AiDot provider={ai.provider} size="large" />
              <span className={styles.aiName}>{ai.name}</span>
              <span className={styles.aiBy}>{ai.by}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="receitas" className={styles.section} aria-labelledby="recipes-title">
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Receitas prontas</p>
          <h2 id="recipes-title" className={styles.sectionTitle}>
            Um time de IAs para cada serviço, <em className={styles.titleEm}>já montado.</em>
          </h2>
          <p className={styles.sectionLead}>
            Cada receita junta IAs diferentes em papéis diferentes, porque uma IA revisa melhor o trabalho da outra do
            que o próprio. Para o resto, tem o chat: é só pedir.
          </p>
        </Reveal>
        <ul className={styles.recipeGrid}>
          {RECIPES.map((recipe) => (
            <li key={recipe.name} className={styles.recipe}>
              <div className={styles.recipeTop}>
                <span className={styles.recipeTeam} aria-hidden="true">
                  {recipe.team.map((provider, index) => (
                    <AiDot key={index} provider={provider} size="large" />
                  ))}
                </span>
                <span className={styles.recipeOut}>{recipe.out}</span>
              </div>
              <h3 className={styles.recipeName}>{recipe.name}</h3>
              <p className={styles.recipeText}>{recipe.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="como-funciona" className={styles.dark} aria-labelledby="how-title">
        <div className={styles.darkInner}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.eyebrowDark}>Como funciona</p>
            <h2 id="how-title" className={styles.darkTitle}>
              Do pedido à entrega, <em className={styles.titleEm}>sem precisar entender de IA.</em>
            </h2>
          </Reveal>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 80} className={styles.step}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.split}`} aria-labelledby="owner-title">
        <Reveal className={styles.splitText}>
          <p className={styles.eyebrow}>Para o dono</p>
          <h2 id="owner-title" className={styles.sectionTitle}>
            Você enxerga o mês inteiro, <em className={styles.titleEm}>sem ler conversa de ninguém.</em>
          </h2>
          <ul className={styles.checks}>
            <li>O que cada pessoa entregou e quanto gastou, por IA</li>
            <li>Um teto de gasto no mês para cada funcionário</li>
            <li>Crédito da empresa em reais, com cada gasto no extrato</li>
            <li>Convite por link: o funcionário entra em minutos</li>
          </ul>
        </Reveal>
        <Reveal delay={80} className={styles.table} aria-hidden="true">
          <div className={styles.tableHead}>
            <span className={styles.tableTitle}>Equipe · novembro</span>
            <span className={styles.tableTotal}>R$ 91,45 no mês</span>
          </div>
          <div className={`${styles.tableRow} ${styles.tableLabels}`}>
            <span>Pessoa</span>
            <span>Entregas</span>
            <span>Gasto</span>
            <span className={styles.alignEnd}>Teto</span>
          </div>
          {TEAM_TABLE.map((person) => (
            <div key={person.name} className={styles.tableRow}>
              <span className={styles.tablePerson}>{person.name}</span>
              <span>{person.deliveries}</span>
              <span>{person.spent}</span>
              <span className={`${styles.alignEnd} ${styles[`status_${person.status}`]}`}>
                <span className={styles.statusDot} /> {person.label}
              </span>
            </div>
          ))}
        </Reveal>
      </section>

      <section id="duvidas" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title">
        <div className={styles.faqHead}>
          <p className={styles.eyebrow}>Dúvidas</p>
          <h2 id="faq-title" className={styles.sectionTitle}>
            Perguntas frequentes
          </h2>
        </div>
        <div className={styles.faq}>
          {FAQ.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                {item.q}
                <span className={styles.faqIcon} aria-hidden="true">
                  +
                </span>
              </summary>
              <p className={styles.faqAnswer}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.closingInner}>
          <h2 id="closing-title" className={styles.closingTitle}>
            Coloque o time de IAs <em className={styles.titleEm}>para trabalhar na sua empresa.</em>
          </h2>
          <p className={styles.closingText}>
            O dono cria a conta e convida a equipe. Quem já tem conta, dono ou funcionário, entra com o e-mail e a senha.
          </p>
          <div className={styles.closingActions}>
            <Link to="/cadastro" className={styles.primaryButton}>
              Criar a conta da empresa
            </Link>
            <Link to="/entrar" className={styles.ghostButton}>
              Já tenho conta
            </Link>
            {demo && (
              <Link to="/raiox" className={styles.ghostButton}>
                Visão raio-x
              </Link>
            )}
          </div>
        </div>
        <footer className={styles.footer}>
          <span className={styles.footerLogo}>OCK</span>
          <span>Claude, GPT e Gemini são marcas das respectivas empresas.</span>
        </footer>
      </section>
    </main>
  );
}
