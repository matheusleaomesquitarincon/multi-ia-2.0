// O câmbio que o servidor usa para cobrar em reais (F17). Fica no banco (platform_settings), e quem muda é a equipe da
// plataforma no painel interno. O servidor lê de novo a cada rodada da limpeza (lib/runs/housekeeping.js) e logo depois
// de uma mudança feita por ele mesmo; até a primeira leitura, vale o câmbio de partida (USD_TO_BRL em lib/ock/pricing.js).

import { setUsdToBrl } from "../ock/pricing.js";
import { supabaseAdmin } from "../runs/supabase-server.js";

/**
 * Busca o câmbio no banco e passa a usá-lo. Devolve o câmbio lido (ou null, se o banco não tiver um válido).
 * @returns {Promise<number | null>}
 */
export async function refreshExchangeRate() {
  const { data, error } = await supabaseAdmin().from("platform_settings").select("usd_to_brl").maybeSingle();
  if (error) throw new Error(`Não deu para ler o câmbio: ${error.message}`);
  const rate = Number(data?.usd_to_brl);
  return setUsdToBrl(rate) ? rate : null;
}
