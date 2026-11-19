// Textos dos termos de uso e da política de privacidade (F05). RASCUNHO: precisa da revisão de um advogado antes da
// primeira empresa de verdade. O que está entre [colchetes] ainda não foi decidido (razão social, CNPJ, contato, foro).
// Mudou algo que a pessoa precisa saber? Troque também TERMS_VERSION (lib/auth/forms.js), para pedir o aceite de novo.

/**
 * @typedef {{ title: string; paragraphs: string[] }} LegalSection
 * @typedef {{ title: string; lead: string; sections: LegalSection[] }} LegalText
 */

/** @type {LegalText} */
export const TERMS = {
  title: "Termos de uso",
  lead: "As regras para usar a plataforma, na empresa e no dia a dia de quem trabalha com ela.",
  sections: [
    {
      title: "1. Quem somos e o que oferecemos",
      paragraphs: [
        "A plataforma é oferecida por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO]. Ela reúne inteligências artificiais de outras empresas (Claude, da Anthropic; GPT, da OpenAI; e Gemini, do Google) num só lugar, para empresas pequenas e médias e seus funcionários.",
        "O uso é feito de três jeitos: receitas prontas (um time de IAs montado para um serviço), receitas próprias (montadas pela pessoa) e tarefas rápidas (um pedido direto, como num chat).",
      ],
    },
    {
      title: "2. Contas: o dono e os funcionários",
      paragraphs: [
        "A empresa é representada por quem cria a conta (o dono). O dono cadastra os funcionários, define o teto de gasto de cada um e pode desativar um acesso a qualquer momento.",
        "Cada pessoa é responsável pela própria senha e pelo que faz com a sua conta. Não compartilhe a senha. Se suspeitar que alguém entrou na sua conta, troque a senha e avise o dono da empresa.",
      ],
    },
    {
      title: "3. Créditos e cobrança",
      paragraphs: [
        "O uso das IAs é pago com os créditos da empresa. Antes de uma receita começar, a plataforma mostra uma estimativa do custo máximo e separa esse valor do saldo; no fim, cobra o consumo real e devolve a diferença. Etapa que falhou não é cobrada.",
        "Na tarefa rápida, cada resposta é cobrada pelo consumo real, e a tela mostra quanto custou.",
        "Preço, forma de pagamento, validade e devolução dos créditos: [A DEFINIR, junto com o formato do preço].",
      ],
    },
    {
      title: "4. O que as IAs entregam",
      paragraphs: [
        "As respostas são geradas por inteligência artificial e podem conter erros, informações desatualizadas ou inventadas. Confira tudo antes de usar, principalmente números, nomes, prazos, preços e informações legais. A decisão de usar um resultado é de quem o usa.",
        "Os textos, documentos e sites gerados pertencem à empresa que os pediu, na medida permitida pelas regras das empresas de IA.",
      ],
    },
    {
      title: "5. Uso permitido",
      paragraphs: [
        "Não use a plataforma para nada ilegal; para enganar, assediar ou prejudicar outras pessoas; para criar conteúdo que viole direitos de terceiros; nem para tentar burlar a segurança da plataforma ou das IAs. Também valem as regras de uso de cada empresa de IA.",
        "Não cole dados pessoais sensíveis de terceiros (saúde, religião, orientação sexual, dados de crianças, documentos) sem necessidade e sem base legal.",
        "Podemos suspender uma conta que descumpra estas regras.",
      ],
    },
    {
      title: "6. Disponibilidade",
      paragraphs: [
        "Fazemos o possível para a plataforma funcionar sem interrupções, mas ela depende das empresas de IA e de outros serviços. Quando uma IA falha no meio de uma receita, a plataforma tenta de novo, troca de IA ou pausa sem perder o que já foi feito.",
      ],
    },
    {
      title: "7. Encerramento e mudanças",
      paragraphs: [
        "O funcionário pode apagar a própria conta a qualquer momento, na aba Meu time. O encerramento da conta da empresa: [A DEFINIR].",
        "Se estes termos mudarem de um jeito importante, avisaremos na plataforma e pediremos o aceite de novo.",
        "Estes termos seguem as leis do Brasil. Foro: [CIDADE/UF]. Contato: [E-MAIL DE CONTATO].",
      ],
    },
  ],
};

/** @type {LegalText} */
export const PRIVACY = {
  title: "Política de privacidade",
  lead: "Quais dados guardamos, para que, quem vê o quê e como apagar. Segue a Lei Geral de Proteção de Dados (LGPD).",
  sections: [
    {
      title: "1. Quem cuida dos seus dados",
      paragraphs: [
        "[RAZÃO SOCIAL], CNPJ [CNPJ]. Encarregado de dados (DPO): [NOME], [E-MAIL DO ENCARREGADO].",
        "Em relação ao conteúdo que a empresa cliente e seus funcionários colocam na plataforma, a empresa cliente decide o que é colocado; nós tratamos esse conteúdo para prestar o serviço a ela.",
      ],
    },
    {
      title: "2. O que guardamos",
      paragraphs: [
        "Da conta: nome, e-mail, empresa, papel (dono ou funcionário), teto de gasto e a data em que você aceitou estes termos.",
        "Do trabalho: os pedidos, as conversas, os arquivos anexados, os resultados e as entregas.",
        "Do uso: quanto cada tarefa e cada receita custou, qual IA e qual modelo foram usados, e os erros técnicos, para cobrar certo e melhorar o serviço.",
        "Senhas não ficam guardadas em texto: o serviço de login guarda só uma versão embaralhada delas.",
      ],
    },
    {
      title: "3. Para onde vão os dados",
      paragraphs: [
        "Para responder, o seu pedido (e os anexos que você mandar) vai para a empresa da IA que vai trabalhar nele: Anthropic, OpenAI ou Google. Essas empresas ficam nos Estados Unidos, então há transferência internacional de dados. Usamos os serviços pagos delas, cujas regras dizem que o conteúdo enviado pela plataforma não é usado para treinar os modelos [CONFIRMAR com os contratos de cada uma antes da primeira empresa].",
        "Os dados da conta e do trabalho ficam guardados no Supabase, nosso serviço de banco de dados [CONFIRMAR a região dos servidores].",
        "Não vendemos dados e não os usamos para publicidade.",
      ],
    },
    {
      title: "4. Quem vê o quê dentro da empresa",
      paragraphs: [
        "O dono da empresa vê as entregas de cada funcionário (os arquivos que as IAs fizeram) e quanto cada tarefa custou.",
        "O dono não vê as suas conversas, os seus pedidos nem os seus anexos.",
        "Colegas não veem o trabalho uns dos outros, a não ser um time de IA que você salvar para a empresa toda.",
      ],
    },
    {
      title: "5. Seus direitos e como apagar",
      paragraphs: [
        "Você pode apagar, a qualquer momento: uma conversa (o × ao lado dela), uma entrega (na aba Entregas), uma receita rodada (nas tarefas recentes) e a sua conta inteira (no fim da aba Meu time).",
        "Ao apagar a conta, somem as suas conversas, anexos, receitas rodadas, pastas, times que eram só seus e o seu login. Ficam com a empresa as entregas (são documentos de trabalho, que o dono já vê), os times salvos para a empresa toda e o extrato de gastos com o seu nome, porque a empresa precisa dele para as contas.",
        "Para os demais direitos da LGPD (confirmar e acessar os dados, corrigir, levar para outro serviço, saber com quem compartilhamos), escreva para [E-MAIL DO ENCARREGADO].",
      ],
    },
    {
      title: "6. Segurança e prazos",
      paragraphs: [
        "O acesso é protegido por login, cada pessoa só enxerga o que é dela, e as chaves das IAs ficam só no servidor. Conteúdo gerado pelas IAs (como um site) só é mostrado numa moldura isolada, que não acessa a sua conta.",
        "Guardamos os dados enquanto a conta existir. Depois de apagados, eles saem do banco na hora e dos arquivos na próxima limpeza automática. Prazo de cópias de segurança e de registros exigidos por lei: [A DEFINIR].",
        "Usamos só os cookies necessários para manter você logado.",
      ],
    },
  ],
};
