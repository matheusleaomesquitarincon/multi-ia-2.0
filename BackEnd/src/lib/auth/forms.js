// Conferência dos formulários de cadastro, de entrada e da senha do convite. Roda no servidor (as ações recebem o
// que o navegador mandou, e qualquer um pode mandar qualquer coisa). Os limites batem com os do banco (migração 1) e do
// Supabase Auth.

export const NAME_MAX_CHARS = 120;
export const EMAIL_MAX_CHARS = 254;
export const PASSWORD_MIN_CHARS = 8;
/** O Supabase guarda a senha com bcrypt, que só olha os primeiros 72 bytes: acima disso, recusamos. */
export const PASSWORD_MAX_BYTES = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {{
 * companyName: string;
 * ownerName: string;
 * email: string;
 * password: string;
 * }} SignUpValues
 */

/** @typedef {keyof SignUpValues} SignUpField */

/**
 * @template Values
 * @template Field
 * @typedef {| { ok: true; values: Values }
 * // `values` volta sem a senha, para preencher o formulário de novo.
 * | { ok: false; errors: Partial<Record<Field, string>>; values: Partial<Values> }} FormResult
 */

/**
 * @param {FormData} formData
 * @param {string} field
 * @returns {string}
 */
export function text(formData, field) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

/**
 * Nome com espaços normais: tira as pontas e junta espaços repetidos.
 * @param {string} value
 * @returns {string}
 */
export function cleanName(value) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

/**
 * @param {string} value
 * @param {string} what
 * @returns {string | undefined}
 */
export function nameProblem(value, what) {
  if (!value) return `Preencha ${what}.`;
  if (value.length > NAME_MAX_CHARS) return `Use até ${NAME_MAX_CHARS} caracteres.`;
  return undefined;
}

/**
 * @param {string} value
 * @returns {string | undefined}
 */
export function emailProblem(value) {
  if (!value) return "Preencha o e-mail.";
  if (value.length > EMAIL_MAX_CHARS || !EMAIL_PATTERN.test(value)) return "Confira o e-mail: ele parece incompleto.";
  return undefined;
}

function passwordProblem(value) {
  if (value.length < PASSWORD_MIN_CHARS) return `A senha precisa de pelo menos ${PASSWORD_MIN_CHARS} caracteres.`;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return "A senha é longa demais.";
  return undefined;
}

/**
 * Cadastro da empresa: nome da empresa, nome do dono, e-mail e senha.
 * @param {FormData} formData
 * @returns {FormResult<SignUpValues, SignUpField>}
 */
export function parseSignUp(formData) {
  const values = {
    companyName: cleanName(text(formData, "companyName")),
    ownerName: cleanName(text(formData, "ownerName")),
    email: normalizeEmail(text(formData, "email")),
    // A senha não é mexida: espaço também conta.
    password: text(formData, "password"),
  };

  const errors = {};
  const companyProblem = nameProblem(values.companyName, "o nome da empresa");
  if (companyProblem) errors.companyName = companyProblem;
  const ownerProblem = nameProblem(values.ownerName, "o seu nome");
  if (ownerProblem) errors.ownerName = ownerProblem;
  const emailError = emailProblem(values.email);
  if (emailError) errors.email = emailError;
  const passwordError = passwordProblem(values.password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      values: { companyName: values.companyName, ownerName: values.ownerName, email: values.email },
    };
  }
  return { ok: true, values };
}

/**
 * @typedef {{
 * email: string;
 * password: string;
 * }} SignInValues
 */

/**
 * Entrada: só confere que veio algo. Se a senha está certa, quem diz é o Supabase.
 * @param {FormData} formData
 * @returns {FormResult<SignInValues, keyof SignInValues>}
 */
export function parseSignIn(formData) {
  const values = { email: normalizeEmail(text(formData, "email")), password: text(formData, "password") };
  const errors = {};
  if (!values.email) errors.email = "Preencha o e-mail.";
  if (!values.password) errors.password = "Preencha a senha.";
  if (values.password.length > 1024) errors.password = "A senha é longa demais.";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values: { email: values.email } };
  return { ok: true, values };
}

/**
 * "Esqueci minha senha": só o e-mail, que precisa parecer um e-mail. Se existe conta com ele, quem sabe é o Supabase.
 * @param {FormData} formData
 * @returns {FormResult<{ email: string }, "email">}
 */
export function parseForgotPassword(formData) {
  const email = normalizeEmail(text(formData, "email"));
  const problem = emailProblem(email);
  if (problem) return { ok: false, errors: { email: problem }, values: { email } };
  return { ok: true, values: { email } };
}

/**
 * @typedef {{
 * password: string;
 * confirm: string;
 * }} NewPasswordValues
 */

/**
 * Senha nova, digitada duas vezes: a do funcionário ao aceitar o convite e a de quem voltou pelo "Esqueci minha senha".
 * @param {FormData} formData
 * @returns {FormResult<NewPasswordValues, keyof NewPasswordValues>}
 */
export function parseNewPassword(formData) {
  const values = { password: text(formData, "password"), confirm: text(formData, "confirm") };
  const errors = {};
  const passwordError = passwordProblem(values.password);
  if (passwordError) errors.password = passwordError;
  else if (values.confirm !== values.password) errors.confirm = "As duas senhas não são iguais. Digite de novo.";

  if (Object.keys(errors).length > 0) return { ok: false, errors, values: {} };
  return { ok: true, values };
}

/** O que a ação de cadastro devolve para a tela. */
/**
 * @typedef {| { status: "idle" }
 * | { status: "invalid"; errors: Partial<Record<SignUpField, string>>; values: Partial<SignUpValues> }
 * | { status: "error"; message: string; values: Partial<SignUpValues> }
 * | { status: "check-email"; email: string }} SignUpState
 */

/** O que a ação de entrada devolve para a tela (quando dá certo, ela leva direto para a página da pessoa). */
/**
 * @typedef {| { status: "idle" }
 * | { status: "invalid"; errors: Partial<Record<keyof SignInValues, string>>; values: Partial<SignInValues> }
 * | { status: "error"; message: string; values: Partial<SignInValues> }} SignInState
 */

/** O que a ação de aceitar o convite devolve (quando dá certo, ela leva direto para o trabalho). */
/**
 * @typedef {| { status: "idle" }
 * | { status: "invalid"; errors: Partial<Record<keyof NewPasswordValues, string>> }
 * | { status: "error"; message: string }} AcceptInviteState
 */
