# AGENTS.md — Regras do projeto Multi-IA

> Este arquivo é lido automaticamente pelo Codex e, via `CLAUDE.md`, pelo Claude Code.
> É a fonte única de regras para qualquer IA que trabalhe neste repositório.
> Mudou uma decisão? Atualize aqui no mesmo pull request.

## 1. O projeto em poucas linhas

Plataforma brasileira de IA **para empresas pequenas e médias** (nome provisório no código: **OCK**).
A empresa assina e cadastra os funcionários. Cada funcionário usa as IAs (Claude, GPT, Gemini) no trabalho do dia a dia,
de três jeitos: **receita pronta** (um time de IAs já montado para um serviço, ex.: "Criar um site"), **receita própria**
(ele monta a dele) ou **tarefa rápida** (só pede, como num chat). A plataforma recomenda a IA, o nível do modelo e o
esforço, mas o funcionário pode escolher outra coisa. O **dono** vê o que cada funcionário entregou, o que fez e quanto
gastou, e define um teto de gasto para cada um.

- Público: empresas pequenas e médias no Brasil e seus funcionários, **não** desenvolvedores. Amplo por enquanto, de propósito.
- Diferenciais: várias IAs num lugar, receitas prontas, controle do dono, tudo em português, preço em reais, sem chave de API.
- Até 19/10/2026 o produto era para a pessoa comum; o motor, as receitas e as regras de segurança daquela fase continuam valendo.
- Visão completa, regras de negócio e telas: `Docs/DOCUMENTO-PROJETO.md`.
- Estado atual e próximos passos: `Docs/PROGRESSO.md`.
- Desenho do banco de dados (tabelas, carteira, quem vê o quê): `Docs/BANCO-DE-DADOS.md`.
- **Falhas e riscos conhecidos: `Docs/FALHAS.md`.** Percebeu uma falha nova (negócio, produto, código, segurança ou
  processo)? Anote lá, no mesmo PR, com o próximo número livre. Resolveu uma? Mude o status e escreva como.

## 2. Quem é quem

| Quem | Papel |
|------|-------|
| **Luis** (dono do produto) | Decide o que construir, aprova issues, testa e faz o merge. Está aprendendo a programar. |
| **Claude** | Arquiteto e programador principal: escreve especificações, quebra em tarefas, programa. |
| **Codex** | Revisor independente dos pull requests; depois, implementa tarefas isoladas. |

### Como trabalhar com o Luis

- Escreva para ele em **português simples**. Ao introduzir um conceito novo, explique em uma ou duas frases o que é e por que importa.
- Prefira mudanças **pequenas e revisáveis** a mudanças grandes.
- Antes de decisões difíceis de desfazer (nova biblioteca, mudança de banco, mudança de arquitetura), **pergunte**.
- Diga sempre **como testar** o que foi feito (comando a rodar, tela a abrir, o que deve aparecer).
- Quem é dono do merge na `main` é o **Leandro** (assumiu o produto). O Claude **pode mergear na `main` por conta própria**, sem precisar de ordem a cada vez — **desde que o merge esteja certo**: CI verde, sem conflito, e a mudança já revisada/aprovada. Na dúvida sobre se está certo, **não mergeia — pergunta**. (O merge deixou de ser do Luis.) Isso vale só pro merge na `main`; **deploy em produção continua exigindo ordem explícita** do Leandro na mesma conversa.

## 3. Stack

| Camada | Escolha |
|--------|---------|
| Telas (`FrontEnd/`) | React 19 + Vite + React Router, em JavaScript (JSX) |
| Servidor (`BackEnd/`) | Node.js + Express 5, em JavaScript (módulos ES) |
| Estilos | CSS Modules (um `.module.css` por componente) usando só os tokens de `FrontEnd/src/styles/tokens.css`. Sem Tailwind |
| Login e banco de dados | Supabase, só pelo servidor: o navegador nunca fala com o Supabase |
| Hospedagem | Um servidor Node sempre ligado (ex.: Railway ou Render), que entrega a API e as telas num endereço só |
| IAs | Ligação direta com cada empresa (Anthropic, OpenAI, Google), sem intermediário |
| Testes automáticos | Vitest (arquivos `*.test.js` ao lado do código que testam) |
| Gerenciador de pacotes | npm, com um `package.json` em cada pasta |
| Node.js | 24 LTS |

Bibliotecas além dessas: proponha e explique antes de instalar.

## 4. Arquitetura

O coração é um **motor de orquestração** separado da interface. O FrontEnd só fala com o BackEnd pela API; o motor nunca
depende de rotas nem de telas. Assim, conector MCP e WhatsApp entram no futuro sem reconstruir nada.

```
FrontEnd (React)  --- /api, com o login em cookie --->  BackEnd (Express)
                                                            |
                                                            v
                                     MOTOR DE ORQUESTRAÇÃO -- receitas e times, executor de etapas, créditos
                                                            |
                                                            +--> IAs (Claude, GPT, Gemini), atrás de uma interface comum
                                                            +--> Supabase (usuários, histórico, créditos)
```

Estrutura de pastas:

```
FrontEnd/src/
  App.jsx            o mapa das telas (endereço -> tela)
  pages/             uma tela por endereço: pede os dados à API e monta os componentes
  components/        pedaços de tela (cada um com seu .module.css). OckEntry é a página inicial contada como história;
                     OwnerHome e MonthStory, o painel do dono; OckWorkspace, o espaço de trabalho; RunProgress, a execução
                     em capítulos; SitePreview e generated-site, a prévia isolada do site feito pelas IAs (seção 6)
  lib/api.js         os pedidos ao servidor; lib/actions.js, os formulários; lib/session.jsx, quem está vendo
  lib/<resto>        cópias das regras simples que rodam dos dois lados, idênticas às do BackEnd (ver abaixo)
  styles/tokens.css  TODAS as cores, fontes, espaçamentos, sombras e movimentos
BackEnd/src/
  server.js, app.js  liga o servidor; o caminho de um pedido (cabeçalhos, conferência de origem, login, rota)
  http/              a ligação com o Express: adapter.js (Request/Response), origin-check.js (pedidos forjados),
                     request-context.js (cookies do pedido atual), navigation.js (redirecionar, não encontrado)
  routes/index.js    o mapa de todas as rotas. routes/api/ são as rotas do chat e das receitas; routes/actions/, os
                     formulários; routes/views.js, o que cada tela precisa para abrir
  lib/engine/        motor: executa as etapas de um time e narra cada passo em eventos
  lib/providers/     um adaptador por IA; deadline.js é o limite de tempo das chamadas
  lib/recipes/       as receitas (papéis, IA sugerida, prompt de sistema, etapas). As instruções nunca saem do servidor
  lib/runs/          a execução vista de fora: banco, carteira, cobrança, chamada interna
  lib/auth/          login, convite, cadastro da empresa e visão raio-x
  lib/ock/           o workspace: equipe, chat, arquivos, gastos
  supabase/          migrations/ (a versão oficial das tabelas), seed.sql (só local) e tests/ (testes do banco)
Docs/                documento do projeto, diário, registro de falhas e guias
.github/workflows/   checagens automáticas que rodam em todo pull request
```

**O que roda dos dois lados.** Algumas regras simples (limites, preços, formatação) ficam em `BackEnd/src/lib` e em
`FrontEnd/src/lib`, no mesmo caminho e com o mesmo texto. Mudou uma? Mude nas duas. O teste
`FrontEnd/src/lib/copies.test.js` falha se elas ficarem diferentes e se algo do servidor (login, chaves, contas de teste,
instruções das IAs) aparecer no FrontEnd.

**Formatos dos dados.** Sem TypeScript, os formatos ficam em comentários JSDoc (`@typedef`, `@param`). Nada confere esses
comentários automaticamente: quem muda um formato atualiza o comentário e os testes.

## 5. Regras de funcionamento (especificação do MVP)

### Erro de uma IA no meio da execução
1. Tenta de novo automaticamente, até **2 vezes**, com uma pequena espera (1 s e depois 2 s). Erro que não adianta
   repetir (ex.: a IA recusou o pedido) pula direto para a troca; defeito no nosso código para na hora.
2. Se persistir, **troca de IA** naquele papel e avisa o usuário (ligado por padrão nas receitas; pode ser desligado).
   Quem assume é a IA recomendada pela receita; se foi ela que falhou, a **IA reserva** do papel (`backupProvider`).
   A IA que assumiu segue no papel nas próximas etapas dele.
3. Se ainda falhar, **pausa sem perder nada**: etapas concluídas ficam salvas; o usuário escolhe tentar de novo, trocar a IA ou cancelar. Ao retomar, continua da etapa que falhou.
4. Etapa que falhou **não é cobrada**.
5. Erro na chave do próprio usuário: avisa e **não** passa a usar créditos da plataforma sem autorização.

### Créditos e estimativa
1. Antes de começar, mostra uma **estimativa** de custo e **reserva** esse valor do saldo. Sem saldo, não começa e oferece recarga.
   Por enquanto, a estimativa é o **máximo** que o time pode gastar ("até R$ X"), calculado de novo no servidor ao
   começar (`BackEnd/src/lib/runs/estimate.js`, decisão do Luis de 25/10/2026).
2. Cobra cada etapa concluída pelo **consumo real**. No fim, devolve a diferença entre o reservado e o gasto.
3. Se o custo for passar da estimativa, **pausa e pergunta** antes de continuar. A plataforma não absorve diferenças.
4. Cancelou no meio: paga só as etapas concluídas; a que estava rodando não é cobrada (decisão do Luis, 25/10/2026).
   **Na tarefa rápida (chat)** não há estimativa antes de cada mensagem (decisão do Luis, 25/10/2026, issue #39):
   antes de qualquer IA o servidor confere saldo e teto, reserva o máximo da resposta depois que o Chefe decide, cobra o
   consumo real numa linha só ("Tarefa rápida · Documento") e a tela mostra "Custou R$ X" em cada resposta.
5. Estimativas honestas, calculadas a partir do histórico real de cada receita. A estimativa mostrada precisa ser confiável — gastar muito além dela é um bug.
6. Internamente, registrar o custo real em **dólar** de cada execução.

### Histórico
- **Para o usuário:** pedido, resultado final, time usado (papéis, IAs e instruções), cada etapa com entrada, saída, status e tempo, créditos cobrados, forma de pagamento e botão "rodar de novo".
- **Só interno:** modelo exato, tokens e custo em dólar por etapa, erros técnicos, trocas de IA, uso por receita.
- **LGPD:** o usuário pode apagar qualquer item ou a conta inteira.

### Limites
- Pedido de até ~**4.000 caracteres** no MVP, com contador visível.
- Limite interno de tamanho da resposta de cada papel, para controlar custo.
- **1 execução simultânea** no plano grátis.

### Visual
- Tudo centralizado em tokens (`FrontEnd/src/styles/tokens.css`). **Nunca** escreva cor, fonte ou espaçamento solto num componente.
- Referência atual (11/11/2026, inspirada em offmarket.so e salesagent.chat): visual editorial, com fundo creme `#FBF9F4`, tinta `#1C1A17`, destaque índigo `#4B47D6`, linhas finas no lugar de caixas com sombra e faixas escuras para abrir e fechar seções; títulos em Newsreader (serifa leve, com o final em itálico) e texto em Inter; etiquetas de status verde, âmbar e vermelho; cor por IA (Claude terracota, GPT verde, Gemini azul). O topo das telas de quem está logado é o `PageHeader`.
- A interface conta o trabalho como uma história: página inicial em capítulos, execução das receitas como linha do tempo e painel do dono com a história do mês. Todo movimento respeita `prefers-reduced-motion`.

## 6. Segurança (inegociável)

- **Nunca** coloque chaves de API, senhas ou tokens no código ou em commits. Eles ficam em `.env.local` (já ignorado pelo Git). Mantenha um `.env.example` só com os nomes das variáveis.
- Chaves de API são usadas **apenas no servidor**. Nada de chave em código que roda no navegador.
- Chaves nunca aparecem em logs nem no histórico. Chaves de usuários (BYOK, fase futura) ficam guardadas à parte, criptografadas.
- Toda entrada do usuário é validada no servidor (tamanho, formato).
- **Pedidos forjados:** todo pedido que muda algo passa pela conferência de origem (`BackEnd/src/http/origin-check.js`). A
  única exceção é a rota interna `/api/runs/:id/continue`, que tem segredo próprio.
- **O navegador não guarda chave nenhuma.** Nada de variável de ambiente no FrontEnd; o cookie do login é `httpOnly`.
- **O site publicado precisa de `SITE_URL`** (o servidor não liga sem ela) e nunca roda com `NODE_ENV=development`: é essa
  variável que libera a visão raio-x.
- **Conteúdo gerado por IA nunca roda solto dentro da nossa página.** Site gerado (HTML/CSS/JS) só é exibido
  numa moldura isolada: `<iframe sandbox="allow-scripts">` **sem** `allow-same-origin` (não enxerga nossa página,
  login, cookies nem créditos) e com uma política que bloqueia qualquer acesso à internet de dentro da moldura.
  Motivo: um texto colado no pedido pode trazer instruções escondidas que levam a IA a escrever código malicioso
  ("injeção de prompt"). Vale para qualquer pessoa que abrir o resultado, inclusive administradores.
  A política tem duas partes: regras no começo do próprio site (`FrontEnd/src/components/generated-site.js`) e o cabeçalho
  `frame-src 'none'` das nossas páginas (`BackEnd/src/app.js` e, no computador, `FrontEnd/vite.config.js`), que não deixa a
  moldura ir para outro endereço.
  **Nunca** abra o site gerado como página do nosso endereço (ex.: um link `blob:` aberto numa aba): ali ele
  enxergaria tudo. Para baixar, o arquivo sai como `application/octet-stream`, que o navegador só salva.

## 7. Padrões de código

- JavaScript com módulos ES e o caminho completo nos imports (`./arquivo.js`). Documente os formatos com JSDoc.
- **Nomes no código em inglês** (variáveis, funções, arquivos). **Textos da interface em português do Brasil.**
- Comentários em português, só onde a lógica não é óbvia.
- Funções pequenas, com um propósito claro. Prefira código simples e legível a código "esperto".
- Antes de abrir um PR, rode as checagens abaixo em `BackEnd/` e em `FrontEnd/`. Elas também rodam sozinhas no GitHub
  (`.github/workflows/ci.yml`), e um PR com checagem vermelha não está pronto.

  | Comando | Onde | O que faz |
  |---------|------|-----------|
  | `npm run lint` | as duas pastas | Procura erros comuns e código desleixado (ESLint) |
  | `npm test` | as duas pastas | Roda os testes automáticos uma vez (`npm run test:watch` fica rodando a cada mudança) |
  | `npm run build` | `FrontEnd/` | Monta a versão de produção das telas |
  | `npm run dev` | as duas pastas | Liga o servidor (porta 3001) e as telas (http://localhost:3000) |

## 8. Fluxo de trabalho no Git

1. Cada tarefa nasce como uma **issue** com descrição e **critério de pronto**, aprovada pelo Luis.
2. Trabalhe num **branch** próprio: `feat/descricao-curta`, `fix/descricao-curta` ou `Docs/descricao-curta`.
3. **Commits** pequenos, com mensagem em português no imperativo (ex.: `adiciona tela de receitas`).
4. Abra um **pull request** dizendo: o que mudou, por quê, e como testar. Referencie a issue (`Closes #12`).
5. A outra IA revisa e comenta no PR. Divergências ficam registradas lá.
6. O **Leandro** é dono do produto; o Claude **pode fazer o merge na `main` por conta própria** quando o PR estiver certo (CI verde, sem conflito, revisado). Na dúvida, pergunta. Deploy em produção é à parte: só com ordem explícita.

**Banco de dados:** toda mudança de tabela entra por **migração** (arquivo SQL em `BackEnd/supabase/migrations/`), num PR como
qualquer outra mudança. Nunca pelo painel do Supabase (editor de tabelas ou de SQL): senão o banco deixa de bater com o
repositório. No merge na `main`, o Supabase aplica as migrações novas sozinho (ligação com o GitHub, ver
`Docs/BANCO-DE-DADOS.md`). Migração já aplicada não se edita: a correção vem numa migração nova.
O computador de desenvolvimento usa o **projeto de testes** do Supabase, nunca o de verdade; as migrações chegam nele
pelo workflow "Banco de testes" (`.github/workflows/test-db.yml`), que também roda por botão num branch de PR.
Toda tabela nova liga o RLS e recebe `grant` explícito só para quem precisa (nunca para `anon`); toda função nova tem o
acesso de todos tirado (`revoke`) antes do `grant`. Dinheiro só se mexe pelas funções da carteira. Os testes em
`BackEnd/supabase/tests/` conferem isso, e cada mudança de acesso vem com teste.

## 9. Escopo do MVP

Revisado em 22/10/2026, com o produto para empresas (detalhes em `Docs/DOCUMENTO-PROJETO.md`).

**Entra:** cadastro da empresa e login de verdade (dono e funcionários); painel do dono (funcionários, teto de gasto,
crédito da empresa, entregas e gastos por funcionário e por IA); workspace com receitas prontas, receita própria e
tarefa rápida; as 4 receitas do MVP (Criar um site, Proposta comercial, Posts para redes sociais e Relatório mensal
para cliente; as três últimas escolhidas pelo Luis em 26/10, issue #54); recomendação de IA com escolha livre do funcionário; histórico; Claude, GPT e Gemini via API,
com medição de custo; geração de arquivos (PDF, Word, Excel, gráficos).

**Fica de fora por enquanto:** pagamento real (empresas convidadas, crédito carregado à mão), vídeo, execução de código
no servidor ("oficina na nuvem"), conector MCP, WhatsApp, nichar para um tipo de empresa.
(O JavaScript "de enfeite" dos sites gerados não conta como execução de código: ele só roda na prévia isolada, no navegador.)
Não implemente nada desta lista sem pedido explícito.
