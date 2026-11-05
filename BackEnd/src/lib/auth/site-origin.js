// O endereço deste site, para montar links que voltam para cá: o do e-mail de confirmação do cadastro e o do convite
// do funcionário. SÓ do servidor. No site publicado vem da configuração (SITE_URL), nunca do que o pedido diz. No
// computador, vem do cabeçalho Origin, que a conferência de origem (http/origin-check.js) já validou.

import { requestHeaders } from "../../http/request-context.js";

/** @returns {Promise<string>} */
export async function siteOrigin() {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const origin = requestHeaders().get("origin");
  if (origin) return origin;
  return "http://localhost:3000";
}
