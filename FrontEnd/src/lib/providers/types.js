// Contrato que toda IA cumpre. O motor só conhece este contrato, nunca uma IA específica:
// trocar a IA simulada por uma real é trocar o adaptador, sem mexer no motor.

/** As IAs disponíveis na plataforma. */
/** @typedef {"claude" | "gpt" | "gemini"} ProviderId */

/**
 * Quanto a IA "pensa" antes de responder. É a maior alavanca de custo e de tempo:
 * - low: vai direto ao ponto, sem raciocínio extra. Mais rápido e barato (tarefas simples/montagem).
 * - medium: um pouco de raciocínio. Bom padrão.
 * - high: raciocina bastante antes de escrever. Mais caro e lento (casos difíceis, back-end, revisão a fundo).
 * O Chefe pode ajustar isso por etapa (otimização de tempo+tokens).
 */
/** @typedef {"low" | "medium" | "high"} Effort */

/**
 * Nível do MODELO dentro de uma mesma IA, do mais barato ao mais forte:
 * - economico: modelo pequeno/barato (tarefas simples). Ex.: Claude Haiku.
 * - padrao: modelo equilibrado (a maioria das tarefas). Ex.: Claude Sonnet.
 * - potente: modelo top (tarefas difíceis, só quando precisa). Ex.: Claude Opus.
 */
/** @typedef {"economico" | "padrao" | "potente"} ModelTier */

/**
 * Ferramentas que a IA pode usar numa chamada, além de escrever. Cada uma existe numa IA só (a pesquisa no Claude, o
 * código no Gemini; veja lib/ock/quick-task.ts) e só liga com o interruptor OCK_AI_TOOLS (lib/providers/mode.ts).
 * - web_search: pesquisar na internet e citar as fontes.
 * - code_execution: escrever e rodar um programa (num ambiente isolado da empresa da IA) para fazer uma conta.
 */
/** @typedef {"web_search" | "code_execution"} AiTool */

/** Uma página que a IA consultou na internet, para a resposta citar. */
/**
 * @typedef {{
 * title: string;
 * url: string;
 * }} WebSource
 */

/** Nível usado quando a etapa não escolhe outro. As receitas ainda não escolhem: todas rodam no padrão. */
export const DEFAULT_TIER = "padrao";

/** O que o motor manda para uma IA em cada etapa. */
/**
 * @typedef {{
 * // Instrução do papel (prompt de sistema).
 * systemPrompt: string;
 * // Texto de entrada da etapa: o pedido do usuário e o que as etapas anteriores produziram.
 * input: string;
 * // Tamanho máximo da resposta, em tokens. Controla o custo.
 * maxOutputTokens: number;
 * // Quanto a IA deve "pensar" nesta etapa. Sem valor, o adaptador usa "medium".
 * effort?: Effort;
 * // Nível do modelo (econômico/padrão/potente). Sem valor, o adaptador usa "padrao".
 * tier?: ModelTier;
 * // Imagens para a IA "enxergar" (visão). Cada uma com o tipo (ex.: image/png) e o conteúdo em base64.
 * images?: { mime: string; base64: string }[];
 * // Ferramentas que a IA pode usar nesta chamada. Sem valor: nenhuma.
 * tools?: AiTool[];
 * // * Exemplo de resposta definido na receita. Só a IA simulada usa; os adaptadores das IAs reais ignoram este campo.
 * sampleResponse?: string;
 * // Permite cancelar a geração no meio.
 * signal?: AbortSignal;
 * }} GenerateRequest
 */

/** Consumo da IA numa etapa, em tokens. É a base do custo. */
/**
 * @typedef {{
 * // Toda a entrada, contando a que veio do cache e a que foi gravada nele.
 * inputTokens: number;
 * // Toda a saída, contando o "pensamento" (as empresas cobram os dois).
 * outputTokens: number;
 * // Quanto da entrada veio do cache da empresa da IA (sai mais barato). Sem valor: nada.
 * cachedInputTokens?: number;
 * // Quanto da entrada foi gravado no cache nesta chamada (na OpenAI, sai mais caro). Sem valor: nada.
 * cacheWriteTokens?: number;
 * // Quantas pesquisas na internet a IA fez (cobradas à parte, por pesquisa). Sem valor: nenhuma.
 * webSearchRequests?: number;
 * }} Usage
 */

/** Cada pedaço que a IA devolve enquanto escreve. */
/**
 * @typedef {| { type: "text"; text: string }
 * | {
 * type: "done";
 * usage: Usage;
 * // Modelo exato usado (vai para o histórico interno).
 * model: string;
 * // true quando a resposta foi cortada por atingir maxOutputTokens.
 * truncated: boolean;
 * // As páginas que a IA citou, quando pesquisou na internet.
 * sources?: WebSource[];
 * // Quantas vezes a IA rodou um programa, quando pôde rodar código.
 * codeRuns?: number;
 * }} GenerateChunk
 */

/** Uma IA: recebe um pedido e devolve a resposta em pedaços, terminando com um "done". */
/**
 * @typedef {{
 * id: ProviderId;
 * generate(request: GenerateRequest): AsyncIterable<GenerateChunk>;
 * }} AiProvider
 */

/**
 * Erro de uma IA. `retryable` diz se vale a pena tentar de novo (ex.: IA sobrecarregada).
 * `model`, quando o conector sabe, é o modelo exato que falhou, e `usage`, o consumo que a empresa da IA informou antes
 * de a resposta cair: vão para o registro interno do custo (F26), que sem eles conta pelo tamanho do texto.
 */
export class ProviderError extends Error {
  retryable;
  model;
  usage;

  constructor(message, options) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options.retryable;
    this.model = options.model;
    this.usage = options.usage;
  }
}
