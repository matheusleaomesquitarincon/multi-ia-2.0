// A "visão raio-x": um atalho SÓ LOCAL para entrar no site como Chefe ou como Funcionário com um clique, sem login,
// e-mail nem crédito, para ver e fazer tudo. Usa as contas de teste que o seed já cria (empresa "Agência Exemplo", já
// com crédito e com teto nos funcionários). NUNCA vale em produção.

/**
 * Liga a visão raio-x. Trava DUPLA de propósito: só com a variável `OCK_DEMO_MODE=1` (que fica só no `.env.local`) E
 * com o servidor em modo de desenvolvimento. O Express não define NODE_ENV sozinho como o Next fazia, então a regra é
 * "só em desenvolvimento" e não "fora de produção": servidor sem a variável fica com o atalho desligado.
 * @returns {boolean}
 */
export function isDemoMode() {
  return process.env.OCK_DEMO_MODE === "1" && process.env.NODE_ENV === "development";
}

/**
 * @typedef {{
 * role: MemberRole;
 * label: string;
 * email: string;
 * password: string;
 * description: string;
 * }} DemoAccount
 */

/** As contas de teste do seed (a senha de todas é a mesma, e só existe no banco local). */
export const DEMO_ACCOUNTS = {
  chefe: {
    role: "owner",
    label: "Ver como Chefe",
    email: "marina@example.com",
    password: "senha-local-123",
    description: "O painel do dono: crédito da empresa, a equipe, os gastos de cada um e os convites.",
  },
  funcionario: {
    role: "employee",
    label: "Ver como Funcionário",
    email: "ana@example.com",
    password: "senha-local-123",
    description: "O espaço de trabalho: o chat com as IAs, as receitas, as entregas e os próprios gastos.",
  },
};

/** Os dois lados da visão raio-x, na ordem da tela. */
export const DEMO_VIEWS = ["chefe", "funcionario"];

/** @typedef {keyof typeof DEMO_ACCOUNTS} DemoView */

/**
 * @param {unknown} value
 * @returns {value is DemoView}
 */
export function isDemoView(value) {
  return value === "chefe" || value === "funcionario";
}
