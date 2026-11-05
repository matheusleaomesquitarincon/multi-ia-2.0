# Multi-IA

Plataforma brasileira de IA para empresas pequenas e médias: os funcionários usam várias IAs (Claude, GPT, Gemini),
sozinhas ou em times prontos ("receitas"), e o dono acompanha entregas e gastos.

```
FrontEnd/   as telas: React, JavaScript e CSS
BackEnd/    o servidor: Express, o motor das IAs e o banco de dados (BackEnd/supabase)
Docs/       documento do projeto, diário, registro de falhas e guias
```

- Regras do projeto para as IAs: [`AGENTS.md`](AGENTS.md)
- Documento do projeto: [`Docs/DOCUMENTO-PROJETO.md`](Docs/DOCUMENTO-PROJETO.md)
- Diário de progresso: [`Docs/PROGRESSO.md`](Docs/PROGRESSO.md)
- Registro de falhas e riscos: [`Docs/FALHAS.md`](Docs/FALHAS.md)
- Como publicar: [`Docs/GUIA-PUBLICACAO.md`](Docs/GUIA-PUBLICACAO.md)

## Como rodar na sua máquina

Precisa do Node.js 24. Na primeira vez, baixe as bibliotecas e crie o arquivo de configuração do servidor:

```bash
cd BackEnd && npm install && cp .env.example .env.local
cd ../FrontEnd && npm install
```

Preencha no `BackEnd/.env.local` as três variáveis do Supabase, sempre do **projeto de testes**. Depois, em dois terminais:

```bash
cd BackEnd && npm run dev     # o servidor, na porta 3001
cd FrontEnd && npm run dev    # as telas, em http://localhost:3000
```

## Checagens

As mesmas que o GitHub roda em todo pull request:

```bash
cd BackEnd && npm run lint && npm test
cd FrontEnd && npm run lint && npm test && npm run build
```
