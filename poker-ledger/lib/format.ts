const dayFmt = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("pt-PT", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Lisbon",
});
const monthFmt = new Intl.DateTimeFormat("pt-PT", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Lisbon",
});

/** Datas de sessão (guardadas como DATE, sem hora). */
export function formatDay(d: Date): string {
  return dayFmt.format(d);
}

export function formatDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

/** "Outubro 2026" */
export function monthLabel(d: Date): string {
  const s = monthFmt.format(d).replace(" de ", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Date → "2026-10-03" (UTC), para <input type="date"> */
export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "2026-10-03" → Date à meia-noite UTC, ou null. */
export function parseDateInput(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayInput(): string {
  // Data de hoje em Lisboa
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}
