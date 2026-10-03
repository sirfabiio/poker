// Cálculo de transferências do fecho de contas. Função pura, sem I/O.

export type Balance = { playerId: string; amount: number }; // cêntimos; + recebe, − paga
export type PlannedTransfer = { fromPlayerId: string; toPlayerId: string; amount: number };

export class SettlementError extends Error {}

type Open = { id: string; left: number };

// Maior primeiro; empate resolvido pelo id para o resultado ser determinístico.
const byLargest = (a: Open, b: Open) => b.left - a.left || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Gera um conjunto reduzido de transferências que salda todos os saldos.
 * Greedy: emparelha repetidamente o maior devedor com o maior credor.
 * Trabalha só com inteiros (cêntimos): nunca perde nem cria cêntimos.
 * Lança SettlementError se a soma dos saldos não for exatamente 0.
 */
export function computeTransfers(balances: readonly Balance[]): PlannedTransfer[] {
  const seen = new Set<string>();
  let sum = 0;
  for (const b of balances) {
    if (!Number.isSafeInteger(b.amount)) {
      throw new SettlementError(`Saldo inválido para ${b.playerId}: tem de ser um inteiro em cêntimos.`);
    }
    if (seen.has(b.playerId)) throw new SettlementError(`Jogador repetido: ${b.playerId}.`);
    seen.add(b.playerId);
    sum += b.amount;
  }
  if (sum !== 0) {
    throw new SettlementError(`A soma dos saldos tem de ser 0 cêntimos, mas é ${sum}.`);
  }

  const debtors: Open[] = balances.filter((b) => b.amount < 0).map((b) => ({ id: b.playerId, left: -b.amount }));
  const creditors: Open[] = balances.filter((b) => b.amount > 0).map((b) => ({ id: b.playerId, left: b.amount }));
  const out: PlannedTransfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byLargest);
    creditors.sort(byLargest);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.left, c.left);
    out.push({ fromPlayerId: d.id, toPlayerId: c.id, amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }

  return out;
}
