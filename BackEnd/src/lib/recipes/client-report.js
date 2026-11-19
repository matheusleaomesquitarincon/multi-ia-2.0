// Receita "Relatório mensal para cliente": o Analista organiza os números que a pessoa colou no pedido e faz as contas
// (variações, totais); o Redator escreve o relatório; o Conferente confere cada número do relatório contra os dados do
// pedido; o Redator aplica as correções e entrega a versão final, que vira um arquivo Word. Quem confere é de outra
// família de IA que quem escreveu (uma IA não enxerga bem o próprio erro, F57).
// Os textos de systemPrompt e instruction são as instruções que cada IA recebe.

import {
  SAMPLE_REPORT_ANALYSIS,
  SAMPLE_REPORT_CHECK,
  SAMPLE_REPORT_DRAFT,
  SAMPLE_REPORT_FINAL,
} from "./client-report.samples.js";
import { NO_MADE_UP_DATA, TEXT_FORMAT_RULES } from "./text-format.js";
import { soloStage } from "./types.js";

/** A regra dos números, comum aos quatro papéis: o relatório só usa o que veio no pedido. */
const ONLY_GIVEN_NUMBERS = `Use SÓ os números que vieram no pedido e as contas feitas a partir deles. Nunca invente, arredonde de outro jeito nem "estime" um número que não está lá. Se um número importante não veio, use um marcador entre colchetes, como [alcance de setembro].`;

export const clientReportRecipe = {
  id: "client-report",
  name: "Relatório mensal para cliente",
  description: "Um analista organiza os números, um redator escreve e um conferente checa cada número.",
  requestPlaceholder:
    "Ex.: Relatório de outubro para a Padaria Pão Dourado (gestão do Instagram). Seguidores: 4.120 (setembro: 3.850). Alcance: 18.400 (setembro: 15.200). 12 posts e 30 stories. Pedidos pelo direct: 46 (setembro: 31). Melhor post: pão de fermentação natural, 5.300 de alcance. Somos a Agência Ponto.",
  resultTitle: "Seu relatório está pronto",
  documentName: "Relatório mensal",

  roles: [
    {
      id: "analyst",
      name: "Analista",
      description: "Organiza os números do mês e faz as contas",
      suggestedProvider: "claude",
      backupProvider: "gemini",
      systemPrompt: `Você é um analista de resultados que ajuda pequenas e médias empresas brasileiras a prestar contas aos clientes delas.
Você é cuidadoso com números: confere cada conta e mostra de onde ela veio.
Escreva sempre em português do Brasil, com números no formato brasileiro (1.234,5).`,
    },
    {
      id: "writer",
      name: "Redator",
      description: "Escreve o relatório e entrega a versão final",
      suggestedProvider: "gpt",
      backupProvider: "claude",
      systemPrompt: `Você é o redator de relatórios mensais que pequenas e médias empresas brasileiras mandam aos clientes delas.
Você escreve de forma clara, objetiva e positiva sem exagero: o cliente precisa entender em dois minutos o que aconteceu no mês e o que vem a seguir.
Escreva sempre em português do Brasil, com números no formato brasileiro (1.234,5).`,
    },
    {
      id: "checker",
      name: "Conferente",
      description: "Confere cada número do relatório contra os dados do pedido",
      suggestedProvider: "claude",
      backupProvider: "gemini",
      systemPrompt: `Você é o conferente de relatórios: antes de um relatório ir para o cliente, você confere cada número dele contra os dados originais e refaz cada conta.
Você é rigoroso e objetivo: aponta só o que está errado ou falta, com a correção.
Escreva sempre em português do Brasil.`,
    },
  ],

  // As quatro fases rodam uma depois da outra, cada uma com uma etapa só.
  stages: [
    soloStage({
      id: "analysis",
      roleId: "analyst",
      name: "Analista",
      summary: "Vai organizar os números do mês e fazer as contas",
      doneSummary: "Organizou os números do mês e fez as contas",
      instruction: `Nesta etapa, organize os números para o redator. Não escreva o relatório.

Organize assim:
1. Cliente e período: quem é o cliente, qual o mês e qual o serviço.
2. Números do mês: cada número que veio no pedido, exatamente como veio, com o do mês anterior quando houver.
3. Contas feitas: variações (em número e em %, com uma casa depois da vírgula) e totais, mostrando a conta (ex.: 270 ÷ 3.850).
4. Destaques: o que melhorou, o que piorou e o que mais chamou atenção, sempre apoiado num número.
5. O que falta: os números ou informações que o relatório precisaria e não vieram.

${ONLY_GIVEN_NUMBERS}

Seja direto: no máximo uma página, em tópicos.`,
      inputs: [{ from: "request", label: "Pedido" }],
      maxOutputTokens: 1500,
      effort: "medium",
      sampleOutput: SAMPLE_REPORT_ANALYSIS,
      format: "text",
    }),
    soloStage({
      id: "draft",
      roleId: "writer",
      name: "Redator",
      summary: "Vai escrever o relatório",
      doneSummary: "Escreveu o relatório a partir da análise",
      instruction: `Nesta etapa, escreva o relatório mensal completo, a partir da análise.

Um bom relatório mensal tem, nesta ordem (adapte ao caso):
- O título, com o nome do cliente e o mês.
- Resumo do mês: duas ou três frases com o principal resultado.
- Números do mês: cada indicador com o valor e a comparação com o mês anterior.
- Destaques: o que deu certo e o que precisa de atenção.
- Próximos passos: o que será feito no mês seguinte.

${ONLY_GIVEN_NUMBERS}

${NO_MADE_UP_DATA}

${TEXT_FORMAT_RULES}`,
      inputs: [
        { from: "request", label: "Pedido" },
        { from: "step", stepId: "analysis", label: "Análise dos números" },
      ],
      maxOutputTokens: 2500,
      effort: "medium",
      sampleOutput: SAMPLE_REPORT_DRAFT,
      format: "text",
    }),
    soloStage({
      id: "check",
      roleId: "checker",
      name: "Conferente",
      summary: "Vai conferir cada número do relatório contra os dados do pedido",
      doneSummary: "Conferiu cada número do relatório contra os dados do pedido",
      instruction: `Nesta etapa, confira o relatório antes de ele ir para o cliente. Os dados verdadeiros são os do pedido.
- Cada número do relatório está no pedido, ou sai de uma conta feita com números do pedido?
- Refaça cada conta (variações, porcentagens, totais). Está certa?
- Algum número foi inventado, trocado de mês ou atribuído ao indicador errado?
- Alguma conclusão não se apoia nos números (ex.: "cresceu muito" quando cresceu pouco)?

Não reescreva o relatório. Liste cada problema numa linha, com a correção (ex.: "Alcance: o relatório diz 21,5%, o certo é 21,1% (3.200 ÷ 15.200)"). Se todos os números conferem, diga isso em uma frase e, se quiser, sugira no máximo dois ajustes de texto.`,
      inputs: [
        { from: "request", label: "Pedido (os dados verdadeiros)" },
        { from: "step", stepId: "draft", label: "Relatório" },
      ],
      maxOutputTokens: 1200,
      effort: "medium",
      sampleOutput: SAMPLE_REPORT_CHECK,
      format: "text",
    }),
    soloStage({
      // A versão final fica com o Redator (quem escreveu): ele parte do próprio relatório e só aplica as correções.
      id: "final",
      roleId: "writer",
      name: "Versão final",
      summary: "O redator aplica as correções e entrega o relatório final",
      doneSummary: "Aplicou as correções do conferente e entregou a versão final",
      instruction: `Nesta etapa, você (o redator) entrega a versão final do relatório.

Comece do SEU relatório e não reescreva do zero: mantenha o que já está bom e aplique TODAS as correções de números que o conferente apontou, exatamente como ele indicou. Se ele disse que tudo confere, entregue o relatório como está (com os ajustes de texto que fizerem sentido).

${ONLY_GIVEN_NUMBERS}

${TEXT_FORMAT_RULES}`,
      inputs: [
        { from: "request", label: "Pedido" },
        { from: "step", stepId: "draft", label: "Seu relatório" },
        { from: "step", stepId: "check", label: "Correções do conferente" },
      ],
      maxOutputTokens: 2500,
      // Aplicar correções no que já existe não pede "pensamento": esforço baixo, mais rápido e barato.
      effort: "low",
      sampleOutput: SAMPLE_REPORT_FINAL,
      format: "text",
    }),
  ],
};
