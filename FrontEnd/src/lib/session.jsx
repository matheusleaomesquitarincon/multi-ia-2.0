// Quem está vendo o site: pedido ao servidor ao abrir e sempre que os dados mudam. Serve só para decidir o que mostrar;
// quem pode fazer o quê é conferido no servidor a cada pedido.

import { createContext, useContext } from "react";
import { useView } from "./useView.js";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const session = useView("/api/session", { keepOnError: true });
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

/**
 * @returns {{ loading: boolean, viewer: { status: string, member?: any }, demo: boolean }}
 */
export function useSession() {
  const { data, loading, failed } = useContext(SessionContext);
  // O topo nunca derruba o site: sem resposta, ele aparece sem a conta.
  if (failed && !data) return { loading: false, viewer: { status: "signed-out" }, demo: false };
  return { loading, viewer: data?.viewer ?? { status: "signed-out" }, demo: data?.demo ?? false };
}
