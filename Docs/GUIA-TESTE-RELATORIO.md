# Guia: testar a receita "Relatório mensal para cliente" (F08)

> Escrito em 11/11/2026 para testar à mão, no computador, com a IA simulada. **Para o chat do Claude:** guie uma parte
> de cada vez, em português simples, e espere a confirmação antes de seguir. **Nunca peça para colar no chat senhas,
> chaves, e-mails ou links de convite.**

## Para que serve

Conferir a quarta e última receita pronta do MVP: o **Analista** (Claude) organiza os números colados no pedido e faz
as contas, o **Redator** (GPT) escreve o relatório, o **Conferente** (Claude) confere cada número contra os dados do
pedido, e o Redator entrega a **versão final**, que vira um Word. Com ela, a aba Receitas não tem mais nenhum
"Em breve".

Com a IA simulada, o relatório que aparece é sempre o mesmo de exemplo (Padaria Pão Dourado), seja qual for o pedido,
e ele "custa" o mesmo que a IA de verdade custaria.

Tempo total: uns 15 minutos.

## Antes de começar

- O site ligado: `npm run dev` em `BackEnd/` e em `FrontEnd/`, e o Supabase local (`npx supabase start` em `BackEnd/`)
  ou o projeto de testes no `BackEnd/.env.local`.
- Com `OCK_DEMO_MODE=1` no `.env.local`, a página `/raiox` entra como Chefe ou como Funcionário com um clique.

## Parte A — O cartão

1. Entre como **Funcionário** e abra a aba **Receitas**.
2. **Esperado:** quatro cartões, todos prontos, nenhum "Em breve". O cartão "Relatório mensal para cliente" mostra o
   time: Analista (Claude), Redator (GPT) e Conferente (Claude).

## Parte B — A receita até o fim

1. Abra o cartão. Na caixa do pedido, cole os números de um mês (o exemplo cinza da caixa serve).
2. Confira a estimativa ("até R$ X") e comece.
3. **Esperado:** quatro capítulos, um depois do outro: Analista, Redator, Conferente e Versão final. No fim, a tela
   "Seu relatório está pronto", com **Copiar o texto** e **Baixar em Word**.
4. Baixe o Word e abra. **Esperado:** título, resumo, números do mês, destaques e próximos passos.

## Parte C — Entregas e gastos

1. Abra a aba **Entregas**. **Esperado:** o Word "Relatório mensal" está lá.
2. Abra **Meus gastos**. **Esperado:** uma linha da receita, com o total das quatro etapas.
3. Entre como **Chefe**. **Esperado:** o gasto aparece no painel, sem o texto do pedido.

## Se algo não bater

Anote em qual parte e passo, com um print, e conte no Claude Code.
