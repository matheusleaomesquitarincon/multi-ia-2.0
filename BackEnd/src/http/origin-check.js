// Proteção contra pedidos forjados (CSRF): outro site não pode mandar um formulário usando o login de quem visita.
// O navegador sempre diz de onde veio o pedido (cabeçalho Origin), e o site de fora não consegue mentir nisso.
// Sem este filtro, o login em cookie valeria para pedidos vindos de qualquer site.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * A rota interna tem o seu próprio segredo e é chamada pelo próprio servidor, sem navegador.
 * @param {string} path
 */
function isInternalRoute(path) {
  return /^\/api\/runs\/[^/]+\/continue$/.test(path);
}

/**
 * @param {{ method: string, path: string, origin?: string, host?: string, siteUrl?: string, production: boolean }} request
 * @returns {boolean}
 */
export function isAllowedOrigin({ method, path, origin, host, siteUrl, production }) {
  if (SAFE_METHODS.has(method) || isInternalRoute(path)) return true;
  if (!origin) return false;
  if (siteUrl && origin === siteUrl.replace(/\/+$/, "")) return true;
  // No site publicado, só o endereço configurado. No computador, o próprio endereço (o Vite repassa o Host original).
  if (production) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function originCheck(req, res, next) {
  const allowed = isAllowedOrigin({
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    host: req.headers.host,
    siteUrl: process.env.SITE_URL,
    production: process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test",
  });
  if (allowed) {
    next();
    return;
  }
  res.status(403).json({ problem: "Pedido recusado: ele não veio do nosso site." });
}
