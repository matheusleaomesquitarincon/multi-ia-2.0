// O prazo de um link, como a tela mostra. Só uma conta, sem dados: roda no servidor e no navegador.

/**
 * "25/10, às 14:30", no horário de Brasília (o servidor pode estar em outro fuso).
 * @param {string} iso
 * @returns {string}
 */
export function deadlineText(iso) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${day}, às ${time}`;
}
