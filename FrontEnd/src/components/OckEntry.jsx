// A porta de entrada do OCK, para quem ainda não entrou, contada como uma história: um pedido, o time que se forma, o
// trabalho, a entrega e o que o dono acompanha. No fim, as mesmas portas de sempre: o dono cria a conta da empresa; quem
// já tem conta (dono ou funcionário) entra. O funcionário não se cadastra sozinho: o acesso vem por convite do dono.
// As cenas são ilustrações com dados de exemplo, nunca dados de uma empresa de verdade.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AiDot } from "./AiDot.jsx";
import { Reveal } from "./Reveal.jsx";
import styles from "./OckEntry.module.css";

function RequestScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.sceneTag}>O funcionário pede</p>
      <p className={styles.bubble}>
        Preciso de uma proposta comercial para a Padaria Sol, com três opções de preço.
        <span className={styles.caret} aria-hidden="true" />
      </p>
      <p className={styles.sceneNote}>Em português, do jeito que ele falaria com um colega.</p>
    </div>
  );
}

const TEAM = [
  { provider: "claude", role: "Chefe", detail: "Organiza o trabalho" },
  { provider: "gpt", role: "Redator", detail: "Escreve a proposta" },
  { provider: "gemini", role: "Conferente", detail: "Confere os números" },
];

function TeamScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.sceneTag}>O time recomendado</p>
      <ul className={styles.teamList}>
        {TEAM.map((member) => (
          <li key={member.role} className={styles.teamMember}>
            <AiDot provider={member.provider} size="large" />
            <span className={styles.teamRole}>{member.role}</span>
            <span className={styles.teamDetail}>{member.detail}</span>
          </li>
        ))}
      </ul>
      <p className={styles.sceneNote}>Não gostou da escolha? O funcionário pode trocar a IA de qualquer papel.</p>
    </div>
  );
}

function WorkScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.sceneTag}>O time em ação</p>
      <ol className={styles.steps}>
        <li className={styles.stepDone}>
          <span className={styles.stepName}>Plano do Chefe</span>
          <span className={styles.stepStatus}>Concluído</span>
        </li>
        <li className={styles.stepWorking}>
          <span className={styles.stepName}>Escrevendo a proposta</span>
          <span className={styles.stepStatus}>Trabalhando…</span>
        </li>
        <li className={styles.stepWaiting}>
          <span className={styles.stepName}>Conferência dos números</span>
          <span className={styles.stepStatus}>Aguardando</span>
        </li>
      </ol>
      <p className={styles.sceneNote}>
        Se uma IA falhar, outra assume o papel e você é avisado. Etapa que falhou não é cobrada.
      </p>
    </div>
  );
}

const FILES = ["PDF", "Word", "Excel", "Gráfico", "Site"];

function DeliveryScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.sceneTag}>A entrega</p>
      <ul className={styles.files}>
        {FILES.map((file) => (
          <li key={file} className={styles.file}>
            {file}
          </li>
        ))}
      </ul>
      <p className={styles.sceneNote}>Pronto para baixar e guardado nas entregas da pessoa.</p>
    </div>
  );
}

function OwnerScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.sceneTag}>O painel do dono · exemplo</p>
      <p className={styles.ownerFigure}>R$ 284,50</p>
      <p className={styles.sceneNote}>gastos neste mês, em reais</p>
      <div className={styles.ownerBar} aria-hidden="true">
        <span className={styles.barClaude} />
        <span className={styles.barGpt} />
        <span className={styles.barGemini} />
      </div>
      <ul className={styles.ownerPeople}>
        <li className={styles.ownerPerson}>
          <span>Ana</span>
          <span>R$ 112,00 de R$ 200,00</span>
        </li>
        <li className={styles.ownerPerson}>
          <span>Bruno</span>
          <span>R$ 96,30 de R$ 150,00</span>
        </li>
      </ul>
    </div>
  );
}

const CHAPTERS = [
  {
    id: "pedido",
    title: "Tudo começa com um pedido",
    text: "O funcionário escreve o que precisa. Sem chave de API, sem instalar nada e sem precisar saber qual IA é melhor para quê.",
    Scene: RequestScene,
  },
  {
    id: "time",
    title: "A plataforma monta o time",
    text: "Claude, GPT e Gemini, num lugar só. Para cada serviço, uma recomendação de IA, de modelo e de esforço. A palavra final é de quem está pedindo.",
    Scene: TeamScene,
  },
  {
    id: "trabalho",
    title: "As IAs trabalham juntas, à vista",
    text: "Dá para acompanhar cada etapa ao vivo. O custo aparece antes de começar, com um máximo reservado, e o time pausa e pergunta se for passar dele.",
    Scene: WorkScene,
  },
  {
    id: "entrega",
    title: "O trabalho vira entrega",
    text: "Uma proposta, um relatório, posts para redes sociais ou um site inteiro. O resultado sai pronto para usar, em arquivo.",
    Scene: DeliveryScene,
  },
  {
    id: "dono",
    title: "E o dono enxerga o mês inteiro",
    text: "O que cada pessoa entregou, quanto gastou e em qual IA, com um teto de gasto para cada um. As conversas continuam sendo de quem conversou.",
    Scene: OwnerScene,
  },
];

/** Qual capítulo está no meio da tela: é ele que aparece no palco fixo ao lado do texto. */
function useActiveChapter() {
  const [active, setActive] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(refs.current.indexOf(entry.target));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const element of refs.current) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { active, refs };
}

/**
 * @param {{ demo: boolean }} props
 */
export function OckEntry({ demo }) {
  const { active, refs } = useActiveChapter();

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>OCK</p>
          <h1 className={styles.title}>O time de IAs da sua empresa</h1>
          <p className={styles.lead}>
            Os funcionários usam Claude, GPT e Gemini no trabalho do dia a dia. O dono acompanha o que cada um entregou e
            quanto gastou, e define um teto de gasto para cada um.
          </p>
          <div className={styles.heroActions}>
            <Link to="/cadastro" className={styles.primaryLink}>
              Criar a conta da empresa
            </Link>
            <Link to="/entrar" className={styles.ghostLink}>
              Entrar
            </Link>
          </div>
          <ul className={styles.heroAis} aria-label="As IAs do time">
            <li className={styles.heroAi}>
              <AiDot provider="claude" size="large" /> Claude
            </li>
            <li className={styles.heroAi}>
              <AiDot provider="gpt" size="large" /> GPT
            </li>
            <li className={styles.heroAi}>
              <AiDot provider="gemini" size="large" /> Gemini
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.story} aria-label="Como funciona">
        <div className={styles.chapters}>
          {CHAPTERS.map(({ id, title, text, Scene }, index) => (
            <article
              key={id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              className={styles.chapter}
            >
              <Reveal>
                <p className={styles.chapterNumber}>Capítulo {index + 1}</p>
                <h2 className={styles.chapterTitle}>{title}</h2>
                <p className={styles.chapterText}>{text}</p>
              </Reveal>
              {/* No celular, cada cena fica logo abaixo do seu texto. */}
              <Reveal className={styles.inlineStage}>
                <Scene />
              </Reveal>
            </article>
          ))}
        </div>

        {/* No computador, um palco fixo troca de cena conforme o texto rola. Repete as cenas: fica fora do leitor de tela. */}
        <div className={styles.stage} aria-hidden="true">
          <div className={styles.stageInner}>
            {CHAPTERS.map(({ id, Scene }, index) => (
              <div key={id} className={index === active ? styles.sceneActive : styles.sceneIdle}>
                <Scene />
              </div>
            ))}
            <ol className={styles.progress}>
              {CHAPTERS.map(({ id }, index) => (
                <li key={id} className={index <= active ? styles.progressOn : styles.progressOff} />
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.doors} aria-labelledby="doors-title">
        <Reveal>
          <h2 id="doors-title" className={styles.doorsTitle}>
            A sua empresa entra nessa história por aqui
          </h2>
        </Reveal>
        <div className={styles.columns}>
          <Reveal as="section" className={styles.card}>
            <h3 className={styles.cardTitle}>Sou o dono</h3>
            <p className={styles.cardText}>
              Crie a conta da empresa. Depois você convida os funcionários e define o teto de gasto de cada um.
            </p>
            <Link to="/cadastro" className={styles.ownerButton}>
              Criar a conta da empresa
            </Link>
          </Reveal>

          <Reveal as="section" delay={80} className={styles.card}>
            <h3 className={styles.cardTitle}>Já tenho conta</h3>
            <p className={styles.cardText}>
              Dono ou funcionário, entre com o seu e-mail e a sua senha. O funcionário recebe o acesso por um convite do
              dono.
            </p>
            <Link to="/entrar" className={styles.ownerButton}>
              Entrar
            </Link>
          </Reveal>

          {demo && (
            <Reveal as="section" delay={160} className={styles.card}>
              <h3 className={styles.cardTitle}>🕶️ Visão raio-x</h3>
              <p className={styles.cardText}>
                Só no seu computador: entre como Chefe ou como Funcionário com um clique, sem login nem crédito, para ver
                o site inteiro. Não aparece no site publicado.
              </p>
              <Link to="/raiox" className={styles.ownerButton}>
                Abrir a visão raio-x
              </Link>
            </Reveal>
          )}
        </div>
      </section>
    </main>
  );
}
