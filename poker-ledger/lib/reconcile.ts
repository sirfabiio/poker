// Reconciliação de diferenças de contagem numa sessão. Função pura, só inteiros (cêntimos).
import { RECONCILE_SOFT_LIMIT_CENTS, RECONCILE_SOFT_LIMIT_PERCENT } from "./config";

export const RECONCILE_METHODS = ["EQUAL", "PROPORTIONAL", "SINGLE_PLAYER"] as const;
export type ReconcileMethod = (typeof RECONCILE_METHODS)[number];

export const METHOD_LABELS: Record<ReconcileMethod, string> = {
  EQUAL: "Igual por todos",
  PROPORTIONAL: "Proporcional às entradas",
  SINGLE_PLAYER: "Um só jogador",
};

export type ReconcilePlayer = { id: string; buyInTotal: number; cashOut: number | null };
export type ReconcileInput = {
  players: readonly ReconcilePlayer[];
  method: ReconcileMethod;
  singlePlayerId?: string | null;
};
export type ReconcileResult = {
  /** D = soma(cashOuts) − soma(buyIns) */
  discrepancy: number;
  /** ajuste por jogador, pela ordem de entrada; soma = −D */
  adjustments: { id: string; adjustment: number }[];
};

export class ReconcileError extends Error {}

export function isReconcileMethod(v: unknown): v is ReconcileMethod {
  return typeof v === "string" && (RECONCILE_METHODS as readonly string[]).includes(v);
}

/** |D| acima de 500 cêntimos OU acima de 5 % do total de entradas. */
export function exceedsSoftLimit(discrepancy: number, totalIn: number): boolean {
  const a = Math.abs(discrepancy);
  return a > RECONCILE_SOFT_LIMIT_CENTS || a * 100 > RECONCILE_SOFT_LIMIT_PERCENT * totalIn;
}

const int = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);

/**
 * Distribui −D pelos jogadores. Método do maior resto com aritmética inteira (BigInt nas quotas);
 * desempate determinístico: maior buyInTotal, depois id. Garante soma(ajustes) = −D ou lança erro.
 */
export function reconcile({ players, method, singlePlayerId }: ReconcileInput): ReconcileResult {
  if (!isReconcileMethod(method)) throw new ReconcileError(`Método desconhecido: ${String(method)}.`);
  if (players.length === 0) throw new ReconcileError("A sessão não tem jogadores.");
  const ids = new Set<string>();
  let totalIn = 0;
  let totalOut = 0;
  for (const p of players) {
    if (ids.has(p.id)) throw new ReconcileError(`Jogador repetido: ${p.id}.`);
    ids.add(p.id);
    if (!int(p.buyInTotal) || p.buyInTotal < 0) throw new ReconcileError(`Entradas inválidas para ${p.id}.`);
    if (p.cashOut === null) throw new ReconcileError("Faltam cash-outs: preenche todos antes de ajustar.");
    if (!int(p.cashOut) || p.cashOut < 0) throw new ReconcileError(`Cash-out inválido para ${p.id}.`);
    totalIn += p.buyInTotal;
    totalOut += p.cashOut;
  }
  const discrepancy = totalOut - totalIn;
  const target = -discrepancy;
  const sign = target < 0 ? -1 : 1;
  const amount = Math.abs(target);

  let shares: number[];
  if (method === "SINGLE_PLAYER") {
    const idx = players.findIndex((p) => p.id === singlePlayerId);
    if (idx < 0) throw new ReconcileError("Escolhe o jogador que absorve a diferença.");
    shares = players.map((_, i) => (i === idx ? amount : 0));
  } else {
    let weights = players.map((p) => (method === "PROPORTIONAL" ? p.buyInTotal : 1));
    // Sem entradas nenhumas não há proporção possível: divide por igual.
    if (weights.every((w) => w === 0)) weights = players.map(() => 1);
    shares = largestRemainder(amount, weights, players);
  }

  const adjustments = players.map((p, i) => ({ id: p.id, adjustment: sign * shares[i] || 0 }));
  const sum = adjustments.reduce((s, a) => s + a.adjustment, 0);
  if (sum !== target) throw new ReconcileError(`Soma dos ajustes (${sum}) diferente de −D (${target}).`);
  return { discrepancy, adjustments };
}

function largestRemainder(amount: number, weights: number[], players: readonly ReconcilePlayer[]): number[] {
  const A = BigInt(amount);
  const W = weights.reduce((s, w) => s + BigInt(w), 0n);
  const floors = weights.map((w) => (A * BigInt(w)) / W);
  const rems = weights.map((w) => (A * BigInt(w)) % W);
  let left = Number(A - floors.reduce((s, f) => s + f, 0n));
  const order = players
    .map((p, i) => i)
    .sort((a, b) => {
      if (rems[a] !== rems[b]) return rems[a] > rems[b] ? -1 : 1;
      if (players[a].buyInTotal !== players[b].buyInTotal) return players[b].buyInTotal - players[a].buyInTotal;
      return players[a].id < players[b].id ? -1 : players[a].id > players[b].id ? 1 : 0;
    });
  const out = floors.map(Number);
  for (const i of order) {
    if (left <= 0) break;
    out[i] += 1;
    left--;
  }
  return out;
}
