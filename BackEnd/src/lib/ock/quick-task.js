// A tarefa rápida (o chat do workspace), na parte que não depende do banco nem da rede: o que cada tipo de resposta
// pede à IA, o máximo que ela pode custar, o que cobrar e como montar o texto que vai para a IA. SÓ do servidor, porque
// leva as instruções das IAs (o que a tela usa fica em chat.ts). Quem executa é lib/ock/run-task.js.
//
// O dinheiro segue as regras das receitas (AGENTS.md, seção 5), com uma diferença decidida pelo Luis em 25/10/2026
// (issue #39): no chat não há estimativa antes de cada mensagem. Depois que o Chefe decide, o servidor reserva o máximo
// que a resposta pode custar, cobra o consumo real numa linha só e a tela mostra "Custou R$ X".

import { costInUsd, imageCostInUsd, usdToCents, USD_TO_BRL } from "./pricing.js";
import { maxImageUsage } from "../providers/images.js";
import { MAX_WEB_SEARCHES, maxInputTokens, outputTokenCap, toolInputTokens } from "../providers/limits.js";

import { UNKNOWN_MODEL } from "../runs/billing.js";

import { MAX_ATTACHMENT_TEXT_CHARS } from "./chat.js";
import { ROUTER } from "./chief.js";
import { pickFormat } from "./document.js";
import { CHART_SAMPLE, DOCUMENT_SAMPLE, PROJECT_SAMPLE, SHEET_SAMPLE } from "./quick-task.samples.js";

/** Quantas trocas recentes da conversa entram como contexto, e o teto de tamanho (para não encarecer a chamada). */
export const HISTORY_TURNS = 6;
export const HISTORY_MAX_CHARS = 4000;

/**
 * O máximo que uma imagem anexada pesa na entrada da IA, em tokens. As IAs reduzem as imagens grandes, mas os modelos
 * novos do Claude aceitam imagens maiores (uns 4.800 tokens numa imagem grande), então a conta usa 5.000.
 */
export const IMAGE_INPUT_TOKENS = 5000;

/** As respostas que não vêm de uma IA. Toda falha diz que nada foi cobrado. */
export const IMAGE_UNAVAILABLE = "Ainda não consigo criar imagens aqui. Isso chega em breve. Nada foi cobrado.";
export const IMAGE_READY = "Pronto! Criei a imagem: ela está aqui embaixo, e dá para baixar.";
export const IMAGE_FAILED =
  "Não consegui criar a imagem agora. Nada foi cobrado. Se o pedido tiver algo que as regras de conteúdo da IA não permitem (pessoas reais, marcas, violência), mude o pedido e tente de novo.";
export const AI_FAILED = "A IA não conseguiu responder agora. Nada foi cobrado. Tente de novo daqui a pouco.";
export const CHART_FAILED =
  "Não consegui montar o gráfico. Diga quais são os rótulos e os valores que você quer ver. Nada foi cobrado.";
export const PROJECT_FAILED =
  "Não consegui montar o projeto em arquivos. Descreva o que ele deve fazer e tente de novo. Nada foi cobrado.";

/** Instrução do trabalhador: um assistente de trabalho geral, em português. */
const WORKER_SYSTEM = `Você é um assistente de trabalho de uma empresa brasileira. Responda em português do Brasil, de forma clara, direta e útil, fazendo exatamente o que o usuário pediu. Não invente dados; quando faltar informação, diga o que falta.`;

// Pesquisa na internet e rodar código só ligam com o interruptor OCK_AI_TOOLS (lib/providers/mode.js). Desligados, a IA
// responde com o que sabe e diz isso: nunca esconde que não pesquisou nem rodou o código (F45).
const SEARCH_OFFLINE_SYSTEM = `${WORKER_SYSTEM} Você não tem acesso à internet nesta conversa: responda com o que já sabe e, se a informação puder ter mudado, diga isso em uma frase.`;
const CODE_OFFLINE_SYSTEM = `${WORKER_SYSTEM} Você não pode rodar código nesta conversa. Resolva a conta ou a lógica passo a passo, mostre o resultado e diga que ele não foi conferido por um programa.`;
const SEARCH_SYSTEM = `${WORKER_SYSTEM} Pesquise na internet quando a resposta depender de informação atual (notícias, preços, cotações, leis, dados recentes) e use as páginas encontradas, de preferência fontes confiáveis e brasileiras quando o assunto for do Brasil. Não invente fontes.`;
const CODE_SYSTEM = `${WORKER_SYSTEM} Para contas, cálculos e análise de números, escreva e rode um programa e use o resultado. Na resposta, explique em português simples o que foi calculado e o resultado, sem mostrar o código, a menos que o funcionário peça.`;

/**
 * Qual IA tem cada ferramenta, e com que nível. A pesquisa é a do Claude: a do Gemini exige mostrar junto um bloco do
 * Google e proíbe misturar o resultado com outro conteúdo (termos de uso do Google, conferidos em 26/10/2026), o que não
 * combina com as entregas da plataforma. Rodar código é do Gemini, sem custo além dos tokens.
 */
const TOOL_WORKERS = {
  pesquisa: {
    provider: "claude",
    tier: "padrao",
    effort: "low",
    tools: ["web_search"],
    reason: "Informação atual: o Claude pesquisa na internet e cita as fontes.",
  },
  codigo: {
    provider: "gemini",
    tier: "padrao",
    effort: "medium",
    tools: ["code_execution"],
    reason: "Conta: o Gemini roda um programa para conferir o resultado.",
  },
};

/** O título da lista de fontes que vai no fim de uma resposta pesquisada na internet (e que o histórico reconhece). */
export const SOURCES_HEADING = "Fontes consultadas:";
/** A frase que vai no fim de uma resposta em que a IA rodou um programa (e que o histórico reconhece). */
export const CODE_RAN_NOTE = "A IA rodou um programa para fazer esta conta.";
/** No máximo quantas fontes aparecem no fim da resposta. */
const MAX_SOURCES = 8;

/** Instrução para quando a tarefa é montar um GRÁFICO: a IA devolve só o JSON dos dados. */
const CHART_SYSTEM = `Você projeta um gráfico a partir do pedido e dos dados. Responda APENAS com um JSON, sem explicação, nesta forma:
{"tipo":"barra|linha|pizza","titulo":"...","rotulos":["..."],"series":[{"nome":"...","valores":[1,2,3]}]}
Regras: "rotulos" são as categorias do eixo X (ou as fatias da pizza). Cada "serie" tem "nome" e "valores" na MESMA ordem dos rótulos. Para pizza, use UMA única série. Use números puros (sem R$, sem %, sem texto).`;

/** Instrução para montar um PROJETO de código em arquivos (vira .zip). */
const PROJECT_SYSTEM = `Você monta um PROJETO de código em arquivos. Responda APENAS com um JSON válido e COMPLETO, sem nenhum texto fora dele, nesta forma:
{"arquivos":[{"caminho":"index.html","conteudo":"<o arquivo inteiro>"}]}
Cada item tem "caminho" (relativo, ex.: src/app.js) e "conteudo" (o conteúdo completo do arquivo). Entregue um projeto funcional, porém ENXUTO: poucos arquivos, para o JSON caber inteiro na resposta sem cortar. Feche sempre o JSON.`;

/** Instrução para a IA quando a tarefa é GERAR UM ARQUIVO: ela devolve só o conteúdo, a OCK faz o arquivo. */
function documentSystem(format) {
  if (format === "csv" || format === "xlsx") {
    return `Você produz o CONTEÚDO de uma planilha em CSV. Responda APENAS com o CSV: uma linha de cabeçalho e as linhas de dados, colunas separadas por vírgula. Sem explicações, sem crases, sem markdown.`;
  }
  return `Você produz o CONTEÚDO de um documento que será salvo em arquivo. Responda APENAS com o texto final do documento, bem organizado (título, seções, listas em texto simples, uma informação por linha). Nada de crases, blocos de código ou comentários seus — só o conteúdo pronto do documento.`;
}

/** Como a IA trabalha em cada tipo de resposta. */
/**
 * @typedef {{
 * // * answer: a resposta é o texto; document, chart e project: a OCK transforma o texto num arquivo; image: a IA cria uma imagem; unavailable: nenhuma IA trabalha (a imagem, com a ferramenta desligada).
 * kind: "answer" | "document" | "chart" | "project" | "image" | "unavailable";
 * action: ChatAction;
 * provider: ProviderId;
 * tier: ModelTier;
 * effort: Effort;
 * // Limite da resposta, em tokens. Controla o custo.
 * maxOutputTokens: number;
 * systemPrompt: string;
 * // Só no documento: o formato do arquivo.
 * format?: DocFormat;
 * // Resposta de exemplo, que só a IA simulada usa.
 * sampleResponse?: string;
 * // As ferramentas que a IA pode usar (pesquisa, código). Sem valor: nenhuma.
 * tools?: AiTool[];
 * // Por que esta IA, quando não foi a que o Chefe escolheu (a ferramenta só existe nela).
 * reason?: string;
 * }} WorkPlan
 */

/**
 * O que a IA escolhida pelo Chefe faz em cada ação. `tools` são as ferramentas ligadas (OCK_AI_TOOLS): com a pesquisa
 * ou o código ligado, a pesquisa vai para o Claude e o código para o Gemini, que são as IAs que têm cada um.
 */
/**
 * Monta o plano de trabalho. `persona` é a instrução de um agente pronto (lib/ock/agent-persona.js): quando a resposta é
 * texto ("responder"), ela entra como preâmbulo do WORKER_SYSTEM, para a IA responder no personagem do agente. Nas ações
 * de formato fixo (documento, gráfico, projeto, imagem, pesquisa/código), a instrução própria delas manda, sem a persona.
 * @param {Route} route
 * @param {string} message
 * @param {ReadonlySet<ToolSwitch>} [tools]
 * @param {string} [persona]
 * @returns {WorkPlan}
 */
export function planWork(route, message, tools = new Set(), persona) {
  const base = { action: route.action, provider: route.provider, tier: route.tier, effort: route.effort };
  switch (route.action) {
    case "imagem":
      if (tools.has("imagem")) {
        // A imagem é do GPT (GPT Image); o pedido vai como foi escrito.
        const reason = "Imagem: o GPT cria a imagem.";
        return {
          ...base,
          provider: "gpt",
          tier: "padrao",
          kind: "image",
          maxOutputTokens: 0,
          systemPrompt: "",
          reason,
        };
      }
      return { ...base, kind: "unavailable", maxOutputTokens: 0, systemPrompt: "" };
    case "pesquisa":
      if (tools.has("pesquisa")) {
        const worker = TOOL_WORKERS.pesquisa;
        return {
          ...base,
          ...worker,
          tools: [...worker.tools],
          kind: "answer",
          maxOutputTokens: 2000,
          systemPrompt: SEARCH_SYSTEM,
        };
      }
      return { ...base, kind: "answer", maxOutputTokens: 1500, systemPrompt: SEARCH_OFFLINE_SYSTEM };
    case "codigo":
      if (tools.has("codigo")) {
        const worker = TOOL_WORKERS.codigo;
        return {
          ...base,
          ...worker,
          tools: [...worker.tools],
          kind: "answer",
          maxOutputTokens: 3000,
          systemPrompt: CODE_SYSTEM,
        };
      }
      return { ...base, kind: "answer", maxOutputTokens: 3000, systemPrompt: CODE_OFFLINE_SYSTEM };
    case "documento": {
      const format = pickFormat(message);
      const sheet = format === "csv" || format === "xlsx";
      return {
        ...base,
        kind: "document",
        maxOutputTokens: 6000,
        systemPrompt: documentSystem(format),
        format,
        sampleResponse: sheet ? SHEET_SAMPLE : DOCUMENT_SAMPLE,
      };
    }
    case "grafico":
      return {
        ...base,
        kind: "chart",
        maxOutputTokens: 2000,
        systemPrompt: CHART_SYSTEM,
        sampleResponse: CHART_SAMPLE,
      };
    case "projeto":
      // Esforço médio e teto alto, para o JSON do projeto caber inteiro (não cortar no meio).
      return {
        ...base,
        effort: "medium",
        kind: "project",
        maxOutputTokens: 12000,
        systemPrompt: PROJECT_SYSTEM,
        sampleResponse: PROJECT_SAMPLE,
      };
    case "responder":
      return {
        ...base,
        kind: "answer",
        maxOutputTokens: route.mode === "projeto" ? 6000 : 1500,
        systemPrompt: persona ? `${persona}\n\n${WORKER_SYSTEM}` : WORKER_SYSTEM,
      };
  }
}

/**
 * O pedido para a IA que vai responder.
 * @param {WorkPlan} plan
 * @param {string} input
 * @param {readonly { mime: string; base64: string }[]} [images]
 * @returns {GenerateRequest}
 */
export function workRequest(plan, input, images = []) {
  return {
    systemPrompt: plan.systemPrompt,
    input,
    maxOutputTokens: plan.maxOutputTokens,
    effort: plan.effort,
    tier: plan.tier,
    images: [...images],
    sampleResponse: plan.sampleResponse,
    ...(plan.tools?.length ? { tools: [...plan.tools] } : {}),
  };
}

const ACTION_LABEL = {
  responder: "Resposta",
  imagem: "Imagem",
  codigo: "Código",
  pesquisa: "Pesquisa",
  documento: "Documento",
  grafico: "Gráfico",
  projeto: "Projeto",
};

/**
 * A descrição da linha de gasto no extrato: o tipo de resposta, nunca o pedido ("Tarefa rápida · Documento").
 * @param {ChatAction} action
 * @returns {string}
 */
export function chargeDescription(action) {
  return `Tarefa rápida · ${ACTION_LABEL[action]}`;
}

/**
 * O aviso fixo de cada tipo de resposta, mostrado junto dela (F45). Quando a IA pesquisou ou rodou um programa, a própria
 * resposta diz isso no fim (SOURCES_HEADING, CODE_RAN_NOTE) e não há aviso; senão, o aviso diz que ela não pesquisou ou
 * não rodou o programa, esteja a ferramenta desligada ou a IA tenha preferido não usar.
 * @param {ChatAction} action
 * @param {string | null} [answer]
 * @returns {string | null}
 */
export function actionNotice(action, answer = null) {
  if (action === "pesquisa" && !answer?.includes(`\n\n${SOURCES_HEADING}\n`)) {
    return "Esta resposta não veio de uma pesquisa na internet: a IA usou o que já sabia, e a informação pode estar desatualizada.";
  }
  if (action === "codigo" && !answer?.endsWith(CODE_RAN_NOTE)) {
    return "A IA fez esta conta sem rodar um programa. Confira os números antes de usar.";
  }
  return null;
}

/**
 * O que vai no fim de uma resposta: as páginas que a IA citou e se ela rodou um programa.
 * @param {{ sources: readonly WebSource[]; codeRuns: number }} answer
 * @returns {string}
 */
export function toolNotes(answer) {
  const parts = [];
  if (answer.sources.length > 0) {
    const lines = answer.sources.slice(0, MAX_SOURCES).map((source) => `- ${source.title}: ${source.url}`);
    parts.push(`${SOURCES_HEADING}\n${lines.join("\n")}`);
  }
  if (answer.codeRuns > 0) parts.push(CODE_RAN_NOTE);
  return parts.map((part) => `\n\n${part}`).join("");
}

/**
 * O máximo que a entrada de um pedido pode pesar, em tokens: o texto (com a folga do português) e as imagens.
 * @param {GenerateRequest} request
 * @returns {number}
 */
export function requestInputTokens(request) {
  return maxInputTokens(request.systemPrompt + request.input) + (request.images?.length ?? 0) * IMAGE_INPUT_TOKENS;
}

/**
 * O máximo, em dólar, que um pedido a uma IA pode custar: a entrada, que já se conhece, o que as ferramentas podem somar
 * a ela (e as pesquisas, cobradas à parte), e o maior texto que a IA pode escrever, contando o "pensamento" (o mesmo
 * teto que os conectores reais mandam, lib/providers/limits.js).
 */
function maxRequestUsd(provider, request) {
  const outputTokens = outputTokenCap(provider, request.maxOutputTokens, request.effort ?? "medium");
  const inputTokens = requestInputTokens(request) + toolInputTokens(request.tools);
  const webSearchRequests = request.tools?.includes("web_search") ? MAX_WEB_SEARCHES : 0;
  return costInUsd(provider, request.tier ?? "padrao", { inputTokens, outputTokens, webSearchRequests });
}

/**
 * O máximo que o Chefe pode gastar para decidir, em centavos: a primeira reserva, antes de qualquer IA.
 * @param {GenerateRequest} request
 * @returns {number}
 */
export function chiefMaxCents(request) {
  return usdToCents(maxRequestUsd(ROUTER.provider, request));
}

/**
 * A reserva para a resposta, em centavos: o que o Chefe já gastou (`chiefUsd`) e o máximo da IA que vai responder.
 * Como o consumo real nunca passa do máximo, a cobrança (taskChargeCents) nunca passa desta reserva.
 * @param {number} chiefUsd
 * @param {WorkPlan} plan
 * @param {GenerateRequest} request
 * @returns {number}
 */
export function answerHoldCents(chiefUsd, plan, request) {
  if (plan.kind === "image") return usdToCents(chiefUsd + imageCostInUsd(maxImageUsage(request.input)));
  return usdToCents(chiefUsd + maxRequestUsd(plan.provider, request));
}

/**
 * O custo real de uma chamada, em dólar (a imagem criada já vem com o custo dela).
 * @param {Pick<AiCallReport, "provider" | "tier" | "usage" | "costUsd">} call
 * @returns {number}
 */
export function callUsd(call) {
  return call.costUsd ?? costInUsd(call.provider, call.tier, call.usage);
}

/**
 * Quanto cobrar por uma resposta pronta, em centavos: o consumo real das chamadas que deram certo (o Chefe e a IA que
 * respondeu), somado em dólar e convertido uma vez só, com no mínimo 1 centavo.
 * @param {readonly AiCallReport[]} calls
 * @returns {number}
 */
export function taskChargeCents(calls) {
  const usd = calls.filter((call) => call.ok).reduce((total, call) => total + callUsd(call), 0);
  return Math.max(1, usdToCents(usd));
}

/**
 * As linhas da tabela interna ai_calls de uma tarefa. `charged`: a resposta foi cobrada (só as chamadas que deram certo).
 * @param {{ companyId: string; memberId: string; taskId: string }} ids
 * @param {readonly AiCallReport[]} calls
 * @param {boolean} charged
 * @returns {AiCallRow[]}
 */
export function taskAiCallRows(ids, calls, charged) {
  return calls.map((call) => ({
    company_id: ids.companyId,
    member_id: ids.memberId,
    run_id: null,
    task_id: ids.taskId,
    step_id: call.stepId,
    attempt: call.attempt,
    provider: call.provider,
    model: call.model ?? UNKNOWN_MODEL,
    tier: call.tier,
    input_tokens: call.usage.inputTokens,
    output_tokens: call.usage.outputTokens,
    // A coluna guarda 6 casas depois da vírgula.
    cost_usd: Number(callUsd(call).toFixed(6)),
    usd_brl: USD_TO_BRL,
    charged: charged && call.ok,
    status: call.ok ? "ok" : "error",
    error_message: call.errorMessage?.slice(0, 2000) ?? null,
    duration_ms: Math.max(0, Math.round(call.durationMs)),
  }));
}

/** Uma troca anterior da conversa. */
/**
 * @typedef {{
 * prompt: string;
 * answer: string | null;
 * }} PastTurn
 */

/**
 * As últimas trocas da conversa, em ordem, para a IA "lembrar" do que já foi dito nela.
 * @param {readonly PastTurn[]} turns
 * @returns {string}
 */
export function historyText(turns) {
  const lines = [];
  for (const turn of turns.slice(-HISTORY_TURNS)) {
    lines.push(`Funcionário: ${turn.prompt}`);
    if (turn.answer) lines.push(`Você: ${turn.answer}`);
  }
  const text = lines.join("\n");
  return text.length > HISTORY_MAX_CHARS ? text.slice(text.length - HISTORY_MAX_CHARS) : text;
}

/** O texto de um anexo, já lido. */
/**
 * @typedef {{
 * name: string;
 * text: string;
 * }} AttachmentText
 */

/**
 * O texto dos anexos que vai para a IA, até MAX_ATTACHMENT_TEXT_CHARS no total (F44). `cut` diz se algo ficou de fora,
 * para a tela avisar.
 * @param {readonly AttachmentText[]} files
 * @returns {{ text: string; cut: boolean }}
 */
export function attachmentContext(files) {
  let remaining = MAX_ATTACHMENT_TEXT_CHARS;
  let cut = false;
  const parts = [];
  for (const file of files) {
    const piece = file.text.slice(0, Math.max(0, remaining));
    remaining -= piece.length;
    let part = `--- Arquivo anexado: ${file.name} ---\n${piece}`;
    if (piece.length < file.text.length) {
      cut = true;
      part += "\n[O resto deste arquivo ficou de fora: passou do limite de texto dos anexos.]";
    }
    parts.push(part);
  }
  return { text: parts.join("\n\n"), cut };
}

/**
 * Junta a conversa, os anexos e a nova mensagem no texto que vai para a IA que responde.
 * @param {string} history
 * @param {string} attachments
 * @param {string} message
 * @returns {string}
 */
export function buildWorkerInput(history, attachments, message) {
  const parts = [];
  if (history) parts.push(`Conversa até agora (contexto; continue de onde parou):\n${history}`);
  if (attachments) parts.push(attachments);
  parts.push(`Nova mensagem do funcionário: ${message}`);
  return parts.join("\n\n");
}

const TITLE_MAX_CHARS = 80;

/**
 * O título de uma conversa nova: o começo da primeira mensagem ou, sem texto, o nome do anexo.
 * @param {string} message
 * @param {readonly string[]} attachmentNames
 * @returns {string}
 */
export function conversationTitle(message, attachmentNames) {
  const text = message.replace(/\s+/g, " ").trim();
  const title = text || (attachmentNames.length > 0 ? `Arquivo: ${attachmentNames.join(", ")}` : "Nova conversa");
  return title.length > TITLE_MAX_CHARS ? `${title.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…` : title;
}

const DOCUMENT_TITLE_MAX_CHARS = 60;

/**
 * O título (e o nome do arquivo) de um documento gerado: a primeira linha do que a IA escreveu, sem marcas como "#".
 * Nunca o pedido: o dono vê as entregas, mas não lê os pedidos (F05, F49). A planilha começa pelos nomes das colunas,
 * então ela se chama só "Planilha".
 * @param {string} content
 * @param {DocFormat} format
 * @returns {string}
 */
export function documentTitle(content, format) {
  if (format === "csv" || format === "xlsx") return "Planilha";
  const firstLine = content.split("\n").find((line) => line.trim() !== "") ?? "";
  const title = firstLine
    .replace(/^[\s#*_>-]+/, "")
    .replace(/[\s*_:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return title.slice(0, DOCUMENT_TITLE_MAX_CHARS).trimEnd() || "Documento";
}
