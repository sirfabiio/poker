import { formatCents } from "@/lib/money";

const sizes = {
  sm: "text-[14px]",
  md: "text-base",
  lg: "font-display text-2xl font-semibold",
  xl: "font-display text-[44px] leading-none font-bold",
} as const;

function Arrow({ up }: { up: boolean }) {
  return (
    <svg aria-hidden="true" width="0.62em" height="0.62em" viewBox="0 0 10 10" className="shrink-0">
      <path d={up ? "M5 1l4.5 8h-9z" : "M5 9L.5 1h9z"} fill="currentColor" />
    </svg>
  );
}

/**
 * Valor monetário em cêntimos. Com `signed`, positivo fica verde com "+" e seta para cima,
 * negativo fica vermelho com "−" e seta para baixo (nunca depende só da cor).
 */
export function Money({
  cents,
  signed = false,
  size = "md",
  className = "",
}: {
  cents: number;
  signed?: boolean;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const text = formatCents(cents);
  if (!signed) {
    return <span className={`money ${sizes[size]} ${className}`}>{cents < 0 ? `−${text}` : text}</span>;
  }
  const big = size === "lg" || size === "xl";
  const tone =
    cents > 0 ? "text-win" : cents < 0 ? (big ? "text-loss" : "text-loss-soft") : "text-ivory/75";
  return (
    <span className={`money inline-flex items-center gap-[0.2em] ${sizes[size]} ${tone} ${className}`}>
      {cents !== 0 && <Arrow up={cents > 0} />}
      <span>
        {cents > 0 ? "+" : cents < 0 ? "−" : ""}
        {text}
      </span>
    </span>
  );
}
