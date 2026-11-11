// Limpeza de tempos em tempos, que o servidor sempre ligado roda sozinho (sem agendador de fora). Hoje: fechar as
// reservas de execuções e mensagens que já terminaram e que ninguém está rodando (F43). Se o servidor cair no meio de
// uma fase cancelada, a reserva dela deixa de segurar o saldo em minutos, não em uma hora. Rodar em dois servidores
// ao mesmo tempo não faz mal: fechar uma reserva já fechada não faz nada.

import { closeStaleHolds } from "./wallet.js";

/** De quanto em quanto tempo a limpeza roda. */
export const HOUSEKEEPING_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Roda a limpeza uma vez. Erro aqui nunca derruba o servidor: fica no terminal e a próxima rodada tenta de novo.
 * @returns {Promise<void>}
 */
export async function runHousekeeping() {
  try {
    const closed = await closeStaleHolds();
    if (closed > 0) console.log(`[housekeeping] Fechei ${closed} reserva(s) de execuções que já tinham terminado.`);
  } catch (error) {
    console.error("[housekeeping] Não consegui fechar as reservas esquecidas:", error);
  }
}

/**
 * Liga a limpeza: uma rodada agora e outra a cada `intervalMs`. Sem o Supabase configurado (o login fica
 * indisponível), não liga. Devolve a função que desliga.
 * @param {number} [intervalMs]
 * @returns {() => void}
 */
export function startHousekeeping(intervalMs = HOUSEKEEPING_INTERVAL_MS) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return () => {};
  void runHousekeeping();
  const timer = setInterval(runHousekeeping, intervalMs);
  // Não segura o processo ligado só por causa dela.
  timer.unref();
  return () => clearInterval(timer);
}
