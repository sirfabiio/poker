// Regras de validação e agregação de sessões. Funções puras, sem I/O.

export type PlayerResultInput = {
  playerId: string;
  cashOut: number | null;
  buyIns: readonly number[];
  /** ajuste de contagem (cêntimos); 0 sem ajuste */
  adjustment?: number;
};
export type SessionInput = {
  id: string;
  date: Date;
  /** true quando há um ajuste de contagem confirmado */
  reconciled?: boolean;
  players: readonly PlayerResultInput[];
};

export type SessionCheck = {
  totalIn: number;
  totalOut: number;
  /** D = cash-outs − entradas (0 quando a contagem bate certo) */
  diff: number;
  /** soma dos ajustes de contagem (= −D quando reconciliada) */
  adjustTotal: number;
  missingCashOuts: number;
  reconciled: boolean;
  /** cash-outs completos e diferença nula ou ajustada */
  valid: boolean;
};

/** Resultado líquido = cashOut − soma dos BuyIns + ajuste. */
export function playerNet(p: PlayerResultInput): number {
  return (p.cashOut ?? 0) - p.buyIns.reduce((s, a) => s + a, 0) + (p.adjustment ?? 0);
}

/**
 * Sessão válida para o fecho = todos os cash-outs preenchidos E (D = 0 OU ajuste confirmado).
 * Em ambos os casos a soma dos líquidos tem de ser exatamente 0.
 */
export function checkSession(players: readonly PlayerResultInput[], reconciled = false): SessionCheck {
  let totalIn = 0;
  let totalOut = 0;
  let adjustTotal = 0;
  let missingCashOuts = 0;
  for (const p of players) {
    for (const a of p.buyIns) totalIn += a;
    adjustTotal += p.adjustment ?? 0;
    if (p.cashOut === null) missingCashOuts++;
    else totalOut += p.cashOut;
  }
  const diff = totalOut - totalIn;
  const balanced = diff + adjustTotal === 0;
  const valid = missingCashOuts === 0 && balanced && (diff === 0 || reconciled);
  return { totalIn, totalOut, diff, adjustTotal, missingCashOuts, reconciled: reconciled && diff !== 0, valid };
}

export type OpenSummary = {
  /** saldo por jogador, só com sessões válidas */
  balances: Map<string, number>;
  validIds: string[];
  invalid: { id: string; date: Date; check: SessionCheck }[];
};

/** Agrega todas as sessões em aberto numa única passagem. */
export function summarizeOpen(sessions: readonly SessionInput[]): OpenSummary {
  const balances = new Map<string, number>();
  const validIds: string[] = [];
  const invalid: OpenSummary["invalid"] = [];
  for (const s of sessions) {
    const check = checkSession(s.players, s.reconciled ?? false);
    if (!check.valid) {
      invalid.push({ id: s.id, date: s.date, check });
      continue;
    }
    validIds.push(s.id);
    for (const p of s.players) {
      balances.set(p.playerId, (balances.get(p.playerId) ?? 0) + playerNet(p));
    }
  }
  return { balances, validIds, invalid };
}
