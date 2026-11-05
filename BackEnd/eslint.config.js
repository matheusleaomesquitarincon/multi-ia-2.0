import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "supabase/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      // Marcas invisíveis em textos e regras são de propósito (ex.: o BOM no começo de um CSV).
      "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true }],
    },
  },
  // Nos testes, IAs falsas podem falhar antes do primeiro pedaço da resposta.
  { files: ["**/*.test.js"], rules: { "require-yield": "off", "no-unsafe-optional-chaining": "off" } },
  // Cerca: o motor, as IAs, as receitas e a execução vista de fora não dependem de HTTP nem de Express.
  // Assim a mesma base serve para a web, o conector MCP e o WhatsApp (regra do AGENTS.md).
  {
    files: ["src/lib/engine/**", "src/lib/providers/**", "src/lib/recipes/**", "src/lib/runs/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/routes/**", "**/http/**"], message: "O motor não pode depender das rotas nem do HTTP." },
            { group: ["express", "express/**"], message: "O motor não pode depender do Express." },
          ],
        },
      ],
    },
  },
];
