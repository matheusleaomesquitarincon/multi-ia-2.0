// O mapa de todas as rotas do servidor: endereço -> função. Os tetos de tempo (maxDuration) vêm de cada rota.

import { Router } from "express";
import { route } from "../http/adapter.js";
import { formAction } from "./action.js";
import { signUpCompany } from "./actions/cadastro.js";
import { acceptInviteAction } from "./actions/convite.js";
import {
  createAgentAction,
  deleteAgentAction,
  demoTopupAction,
  inviteEmployeeAction,
  newLinkAction,
  setStatusAction,
  updateBudgetAction,
} from "./actions/dono.js";
import { signIn, signOut } from "./actions/entrar.js";
import { entrarComoDemo } from "./actions/raiox.js";
import { changePasswordAction } from "./actions/trocar-senha.js";
import * as conversation from "./api/ock/conversations/[id]/route.js";
import * as conversations from "./api/ock/conversations/route.js";
import * as deliveries from "./api/ock/deliveries/route.js";
import * as demoKeys from "./api/ock/demo-keys/route.js";
import * as file from "./api/ock/files/[id]/route.js";
import * as files from "./api/ock/files/route.js";
import * as folders from "./api/ock/folders/route.js";
import * as chat from "./api/ock/route.js";
import * as speak from "./api/ock/speak/route.js";
import * as spending from "./api/ock/spending/route.js";
import * as teamMember from "./api/ock/team/[id]/route.js";
import * as transcribe from "./api/ock/transcribe/route.js";
import * as runCancel from "./api/runs/[id]/cancel/route.js";
import * as runContinue from "./api/runs/[id]/continue/route.js";
import * as runDocument from "./api/runs/[id]/document/route.js";
import * as runEvents from "./api/runs/[id]/events/route.js";
import * as runResume from "./api/runs/[id]/resume/route.js";
import * as run from "./api/runs/[id]/route.js";
import * as runs from "./api/runs/route.js";
import * as confirm from "./confirmar/route.js";
import { demoView, inviteView, ownerView, recipeExistsView, sessionView, workspaceView } from "./views.js";

const METHODS = { GET: "get", POST: "post", PUT: "put", PATCH: "patch", DELETE: "delete" };

/** Liga ao endereço todos os métodos que o arquivo da rota oferece. */
function mount(router, path, module) {
  for (const [method, verb] of Object.entries(METHODS)) {
    if (module[method]) router[verb](path, route(module[method], module.maxDuration));
  }
}

export function apiRoutes() {
  const router = Router();

  mount(router, "/api/ock", chat);
  mount(router, "/api/ock/conversations", conversations);
  mount(router, "/api/ock/conversations/:id", conversation);
  mount(router, "/api/ock/deliveries", deliveries);
  mount(router, "/api/ock/demo-keys", demoKeys);
  mount(router, "/api/ock/files", files);
  mount(router, "/api/ock/files/:id", file);
  mount(router, "/api/ock/folders", folders);
  mount(router, "/api/ock/speak", speak);
  mount(router, "/api/ock/spending", spending);
  mount(router, "/api/ock/team/:id", teamMember);
  mount(router, "/api/ock/transcribe", transcribe);
  mount(router, "/api/runs", runs);
  mount(router, "/api/runs/:id", run);
  mount(router, "/api/runs/:id/cancel", runCancel);
  mount(router, "/api/runs/:id/continue", runContinue);
  mount(router, "/api/runs/:id/document", runDocument);
  mount(router, "/api/runs/:id/events", runEvents);
  mount(router, "/api/runs/:id/resume", runResume);
  mount(router, "/confirmar", confirm);

  router.get("/api/session", route(sessionView));
  router.get("/api/views/trabalho", route(workspaceView));
  router.get("/api/views/dono", route(ownerView));
  router.get("/api/views/convite/:token", route(inviteView));
  router.get("/api/views/receitas/:recipeId", route(recipeExistsView));
  router.get("/api/views/raiox", route(demoView));

  const actions = {
    "entrar/sign-in": signIn,
    "cadastro/sign-up": signUpCompany,
    "convite/accept": acceptInviteAction,
    "trocar-senha/change": changePasswordAction,
    "dono/invite": inviteEmployeeAction,
    "dono/new-link": newLinkAction,
    "dono/budget": updateBudgetAction,
    "dono/status": setStatusAction,
    "dono/agent-create": createAgentAction,
    "dono/agent-delete": deleteAgentAction,
    "dono/demo-topup": demoTopupAction,
  };
  for (const [name, action] of Object.entries(actions)) {
    router.post(`/api/actions/${name}`, route(formAction(action)));
  }
  router.post(
    "/api/actions/entrar/sign-out",
    route(async () => {
      await signOut();
      return Response.json({});
    }),
  );
  router.post(
    "/api/actions/raiox/:view",
    route(async (_request, context) => {
      const { view } = await context.params;
      await entrarComoDemo(view);
      return Response.json({});
    }),
  );

  return router;
}
