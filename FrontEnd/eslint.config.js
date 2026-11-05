import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // O parser não liga os componentes usados em JSX às variáveis; por isso, nomes com maiúscula ficam de fora.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^(_|[A-Z])", caughtErrors: "none" }],
      "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true }],
    },
  },
  {
    files: ["*.config.js", "src/**/*.test.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "require-yield": "off", "no-unsafe-optional-chaining": "off" },
  },
  // Cerca: a tela nunca importa código do servidor nem guarda chaves.
  {
    files: ["src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/BackEnd/**"], message: "A tela fala com o servidor só pela API (lib/api.js)." }] },
      ],
    },
  },
];
