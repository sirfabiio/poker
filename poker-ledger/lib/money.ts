// Valores monetários são SEMPRE inteiros em cêntimos.

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1250 → "12,50 €" (sem sinal). */
export function formatCents(cents: number): string {
  return eur.format(Math.abs(cents) / 100);
}

/** 1250 → "12,50" — para preencher campos de texto. */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `-${s}` : s;
}

/**
 * Converte texto introduzido ("12", "12,5", "12.50", "1 200,00", "20€") em cêntimos,
 * sem passar por floats. Devolve null se for inválido ou negativo.
 */
export function parseEuros(input: string): number | null {
  const s = input.replace(/[\s€ ]/g, "");
  if (!s) return null;
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const euros = Number(m[1]);
  const cents = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return euros * 100 + cents;
}

export const MAX_AMOUNT = 1_000_000_00; // 1 milhão de euros, em cêntimos

export function isValidAmount(n: unknown, allowZero = false): n is number {
  return (
    typeof n === "number" &&
    Number.isSafeInteger(n) &&
    n <= MAX_AMOUNT &&
    (allowZero ? n >= 0 : n > 0)
  );
}
