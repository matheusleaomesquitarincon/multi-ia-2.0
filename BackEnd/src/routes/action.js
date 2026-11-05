// As ações dos formulários: a tela manda o formulário e recebe de volta o estado que deve mostrar. Se a ação mandar a
// pessoa para outro lugar, a resposta é { redirect } (http/adapter.js).

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * @param {(previous: undefined, formData: FormData) => Promise<unknown>} action
 */
export function formAction(action) {
  return async (request) => {
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json(
        { status: "error", message: "Não entendemos o pedido enviado." },
        { status: 400, headers: NO_STORE },
      );
    }
    const state = await action(undefined, formData);
    return Response.json(state ?? {}, { headers: NO_STORE });
  };
}
