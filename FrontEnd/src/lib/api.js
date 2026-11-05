// A conversa da tela com o servidor para abrir páginas e mandar formulários. Tudo no mesmo endereço do site: o login vai
// no cookie, que o JavaScript da página nem consegue ler, e nenhuma chave passa por aqui.

const OFFLINE = "Não conseguimos falar com o servidor. Confira sua internet e tente de novo.";
const SERVER = "Algo deu errado do nosso lado. Tente de novo daqui a pouco.";

/** O nome do aviso de que os dados mudaram: a tela aberta busca de novo o que está mostrando. */
export const REFRESH_EVENT = "ock:refresh";

/**
 * Busca os dados de uma tela. Não encontrado vira { notFound: true }; o servidor pode responder { redirect } para mandar
 * a pessoa para outro lugar. Outros erros estouram para a tela de erro.
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function fetchView(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 404) return { notFound: true };
  if (!response.ok) throw new Error(`O servidor respondeu ${response.status} em ${url}.`);
  return response.json();
}

/**
 * Manda um formulário para o servidor e devolve o estado que a tela deve mostrar. Se o servidor mandar a pessoa para
 * outro lugar, a página recarrega nesse endereço (assim o topo e tudo o mais passam a valer para o novo login).
 * @param {string} url
 * @param {FormData} [formData]
 * @param {any} [previous] O estado atual, mantido enquanto a página troca de endereço.
 * @returns {Promise<any>}
 */
export async function postForm(url, formData, previous) {
  let response;
  try {
    response = await fetch(url, { method: "POST", body: formData });
  } catch {
    return { ...previous, status: "error", message: OFFLINE };
  }

  let state;
  try {
    state = await response.json();
  } catch {
    return { ...previous, status: "error", message: SERVER };
  }

  if (state.redirect) {
    window.location.assign(state.redirect);
    return previous ?? { status: "idle" };
  }
  if (!response.ok && !state.status) return { ...previous, status: "error", message: state.problem ?? SERVER };
  if (response.headers.get("X-Refresh-View")) window.dispatchEvent(new Event(REFRESH_EVENT));
  return state;
}
