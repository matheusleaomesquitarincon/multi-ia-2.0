// As ações dos formulários. Cada uma manda o formulário para a rota dela no servidor (BackEnd/src/routes/index.js), que
// confere tudo de novo: quem pede, a empresa e o que veio.

import { postForm } from "./api.js";

const action = (name) => (previous, formData) => postForm(`/api/actions/${name}`, formData, previous);

export const signIn = action("entrar/sign-in");
export const forgotPasswordAction = action("esqueci-senha/request");
export const signUpCompany = action("cadastro/sign-up");
export const acceptInviteAction = action("convite/accept");
export const changePasswordAction = action("trocar-senha/change");
export const inviteEmployeeAction = action("dono/invite");
export const newLinkAction = action("dono/new-link");
export const updateBudgetAction = action("dono/budget");
export const setStatusAction = action("dono/status");
export const createAgentAction = action("dono/agent-create");
export const deleteAgentAction = action("dono/agent-delete");
export const demoTopupAction = action("dono/demo-topup");

export function signOut() {
  return postForm("/api/actions/entrar/sign-out");
}

/** @param {string} view */
export function entrarComoDemo(view) {
  return postForm(`/api/actions/raiox/${encodeURIComponent(view)}`);
}
