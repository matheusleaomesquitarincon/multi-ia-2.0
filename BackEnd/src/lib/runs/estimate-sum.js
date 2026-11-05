// A soma da estimativa para um time. Separada de estimate.js porque roda também no navegador, que recebe só os números
// de cada etapa, nunca as instruções das IAs.

/**
 * A estimativa para um time: a soma do máximo de cada etapa com a IA que vai fazê-la, vezes as vezes que ela pode
 * rodar. Papel sem IA no time (não deveria acontecer) conta com a IA mais cara, para nunca estimar a menos.
 * @param {readonly { provider?: string, roleId: string, runs: number, cents: Record<string, number> }[]} costs
 * @param {Partial<Record<string, string>>} team
 * @returns {number}
 */
export function estimateCents(costs, team) {
  return costs.reduce((total, cost) => {
    const provider = cost.provider ?? team[cost.roleId];
    const once = provider ? cost.cents[provider] : Math.max(...Object.values(cost.cents));
    return total + cost.runs * once;
  }, 0);
}
