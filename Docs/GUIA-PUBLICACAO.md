# Guia de publicação

O site roda como um único serviço Node.js: o BackEnd entrega a API e as telas já montadas (`FrontEnd/dist`), num endereço
só. Serve qualquer hospedagem de servidor Node sempre ligado (ex.: Railway ou Render).

## Comandos do serviço

- **Build:** `cd FrontEnd && npm ci && npm run build && cd ../BackEnd && npm ci --omit=dev`
- **Start:** `cd BackEnd && node src/server.js`

## Variáveis de ambiente

| Variável | Valor |
|----------|-------|
| `SITE_URL` | O endereço público, sem barra no fim. **Sem ela, o servidor não liga** |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Do projeto do Supabase de produção |
| `OCK_CLAUDE_KEY`, `OCK_GPT_KEY`, `OCK_GEMINI_KEY` | Chaves separadas para o site no ar |
| `OCK_AI_TOOLS` | As ferramentas ligadas (opcional) |
| `INTERNAL_BASE_URL` | Só se a hospedagem não deixar o servidor chamar a si mesmo em `127.0.0.1` |

**Nunca defina** `NODE_ENV=development` nem `OCK_DEMO_MODE` no site publicado.

## Antes de publicar

1. No Supabase (Authentication → URL Configuration), coloque o endereço do site em Site URL e em Redirect URLs.
2. No Supabase (Integrations → GitHub), aponte a ligação para este repositório, com a pasta de trabalho `BackEnd`. Tire a
   ligação com o repositório antigo: os dois não podem aplicar migrações no mesmo banco.
3. No GitHub deste repositório, crie o segredo `SUPABASE_TEST_DB_URL` para o workflow "Banco de testes".

## Depois de publicar, confira

- `/` abre a página inicial e `/raiox` mostra "Página não encontrada".
- Cadastro, login, convite e uma receita funcionam até o fim.
