import type { ReactNode } from "react";
import { Chip } from "./Chip";
import { Money } from "./Money";

type Party = { name: string; avatarColor: string };

/** Talão de transferência com borda tracejada; carimbo "PAGO" quando pago. */
export function Ticket({
  from,
  to,
  amount,
  paid,
  children,
}: {
  from: Party;
  to: Party;
  amount: number;
  paid: boolean;
  children?: ReactNode;
}) {
  return (
    <article className="ticket p-4">
      <div className="flex items-center gap-3">
        <Chip name={from.name} color={from.avatarColor} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px]">
            <strong className="font-semibold">{from.name}</strong>
            <span className="text-ivory/75"> paga a </span>
            <strong className="font-semibold">{to.name}</strong>
          </p>
          <div className="flex items-center gap-3">
            <Money cents={amount} size="lg" className="text-gold-soft" />
            {paid && <span className="stamp px-2 py-0.5 font-display text-sm font-bold">PAGO</span>}
          </div>
        </div>
        <Chip name={to.name} color={to.avatarColor} size="sm" />
      </div>
      {children && <div className="mt-3 border-t border-dashed border-white/20 pt-3">{children}</div>}
    </article>
  );
}
