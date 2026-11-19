// Respostas de exemplo da receita "Relatório mensal para cliente", devolvidas pela IA simulada. Mostram o caminho
// inteiro sem gastar: a análise dos números, o relatório do redator, a conferência e a versão final.

export const SAMPLE_REPORT_ANALYSIS = `1. Cliente e período
- Padaria Pão Dourado, outubro de 2026. Gestão do Instagram pela Agência Ponto.

2. Números do mês (como vieram no pedido)
- Seguidores: 4.120 (setembro: 3.850).
- Alcance: 18.400 contas (setembro: 15.200).
- Posts publicados: 12. Stories: 30.
- Mensagens no direct pedindo encomenda: 46 (setembro: 31).

3. Contas feitas
- Seguidores: +270, alta de 7,0% (270 ÷ 3.850).
- Alcance: +3.200, alta de 21,1% (3.200 ÷ 15.200).
- Pedidos pelo direct: +15, alta de 48,4% (15 ÷ 31).

4. Destaques
- O post do pão de fermentação natural foi o de maior alcance (5.300 contas).
- Os pedidos pelo direct cresceram mais que o alcance: o público novo está comprando.

5. O que falta
- [meta do mês combinada com o cliente], [investimento em anúncios, se houve].`;

export const SAMPLE_REPORT_DRAFT = `# Relatório mensal — Padaria Pão Dourado — outubro de 2026

## Resumo do mês
Outubro foi o melhor mês desde o começo do trabalho: o perfil ganhou **270 seguidores** e os pedidos pelo direct subiram **48,4%**.

## Números do mês
- Seguidores: 4.120, alta de 7,0% sobre setembro (3.850).
- Alcance: 18.400 contas, alta de 21,1% sobre setembro (15.200).
- Publicações: 12 posts e 30 stories.
- Pedidos pelo direct: 46, alta de 48,4% sobre setembro (31).

## Destaques
- O post do pão de fermentação natural alcançou 5.300 contas, o maior do mês.
- O público novo está comprando: os pedidos cresceram mais que o alcance.

## Próximos passos
- Repetir o formato do post da fermentação natural em novembro.
- Combinar a meta de pedidos para novembro: [meta do mês].`;

export const SAMPLE_REPORT_CHECK = `Todos os números do relatório conferem com os dados do pedido, e as contas estão certas.
- Ajuste: no resumo, diga também o alcance (18.400 contas), que é o número que o cliente mais acompanha.`;

export const SAMPLE_REPORT_FINAL = `# Relatório mensal — Padaria Pão Dourado — outubro de 2026

## Resumo do mês
Outubro foi o melhor mês desde o começo do trabalho: o perfil alcançou **18.400 contas**, ganhou **270 seguidores** e os pedidos pelo direct subiram **48,4%**.

## Números do mês
- Seguidores: 4.120, alta de 7,0% sobre setembro (3.850).
- Alcance: 18.400 contas, alta de 21,1% sobre setembro (15.200).
- Publicações: 12 posts e 30 stories.
- Pedidos pelo direct: 46, alta de 48,4% sobre setembro (31).

## Destaques
- O post do pão de fermentação natural alcançou 5.300 contas, o maior do mês.
- O público novo está comprando: os pedidos cresceram mais que o alcance.

## Próximos passos
- Repetir o formato do post da fermentação natural em novembro.
- Combinar a meta de pedidos para novembro: [meta do mês].`;
