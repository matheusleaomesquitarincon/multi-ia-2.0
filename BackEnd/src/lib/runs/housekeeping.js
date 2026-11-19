// Limpeza de tempos em tempos, que o servidor sempre ligado roda sozinho (sem agendador de fora). Hoje:
// - fechar as reservas de execuções e mensagens que já terminaram e que ninguém está rodando (F43). Se o servidor cair
//   no meio de uma fase cancelada, a reserva dela deixa de segurar o saldo em minutos, não em uma hora;
// - apagar da pasta de arquivos o conteúdo que perdeu o registro há mais de 1 hora (F28, LGPD): quem apagou o registro
//   direto no banco, ou um apagar que falhou no meio;
// - ler de novo o câmbio que a equipe da plataforma definiu no painel interno (F17).
// Rodar em dois servidores ao mesmo tempo não faz mal: fechar uma reserva fechada ou apagar o que já sumiu não faz nada.
// Cada tarefa tem o próprio try: o erro de uma não impede a outra.

import { removeOrphanFiles } from "../ock/files.js";
import { refreshExchangeRate } from "../platform/exchange.js";
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
  try {
    const removed = await removeOrphanFiles();
    if (removed > 0) console.log(`[housekeeping] Apaguei ${removed} arquivo(s) da pasta que não tinham mais registro.`);
  } catch (error) {
    console.error("[housekeeping] Não consegui apagar os arquivos esquecidos:", error);
  }
  try {
    await refreshExchangeRate();
  } catch (error) {
    console.error("[housekeeping] Não consegui ler o câmbio; sigo com o anterior:", error);
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
