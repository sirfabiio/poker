// Regras de validação e agregação de sessões. Funções puras, sem I/O.

export type PlayerResultInput = { playerId: string; cashOut: number | null; buyIns: readonly number[] };
export type SessionInput = { id: string; date: Date; players: readonly PlayerResultInput[] };

export type SessionCheck = {
  totalIn: number;
  totalOut: number;
  /** cash-outs − entradas (0 quando está certa) */
  diff: number;
  missingCashOuts: number;
  valid: boolean;
};

/** Resultado líquido de um jogador numa sessão = cashOut − soma dos BuyIns. */
export function playerNet(p: PlayerResultInput): number {
  return (p.cashOut ?? 0) - p.buyIns.reduce((s, a) => s + a, 0);
}

/** Uma sessão só conta para o fecho com todos os cash-outs preenchidos e a soma certa. */
export function checkSession(players: readonly PlayerResultInput[]): SessionCheck {
  let totalIn = 0;
  let totalOut = 0;
  let missingCashOuts = 0;
  for (const p of players) {
    for (const a of p.buyIns) totalIn += a;
    if (p.cashOut === null) missingCashOuts++;
    else totalOut += p.cashOut;
  }
  const diff = totalOut - totalIn;
  return { totalIn, totalOut, diff, missingCashOuts, valid: missingCashOuts === 0 && diff === 0 };
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
    const check = checkSession(s.players);
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
