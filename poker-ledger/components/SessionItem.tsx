import Link from "next/link";
import { formatDay } from "@/lib/format";
import { Money } from "@/components/ui/Money";

export type SessionItemData = {
  id: string;
  date: Date;
  players: number;
  pot: number;
  status: "ready" | "pending" | "closed";
  label?: string | null;
};

const STATUS = {
  ready: { text: "Pronta", cls: "bg-win/15 text-win", icon: "✓" },
  pending: { text: "Por acertar", cls: "bg-loss/15 text-loss-soft", icon: "!" },
  closed: { text: "Fechada", cls: "bg-white/10 text-ivory/80", icon: "🔒︎" },
} as const;

export function SessionItem({ s }: { s: SessionItemData }) {
  const st = STATUS[s.status];
  return (
    <li className="cv-auto">
      <Link
        href={`/sessoes/${s.id}`}
        className="glass flex items-center gap-3 rounded-[24px] px-4 py-3 transition-transform duration-150 active:scale-[0.99]"
      >
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-ink/40 text-lg text-gold-soft">
          ♠{"︎"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold capitalize">{formatDay(s.date)}</span>
          <span className="block text-[13px] text-ivory/75">
            {s.players} {s.players === 1 ? "jogador" : "jogadores"} · pote <Money cents={s.pot} size="sm" className="text-[13px]" />
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${st.cls}`}>
          <span aria-hidden="true">{st.icon} </span>
          {s.status === "closed" && s.label ? s.label : st.text}
        </span>
      </Link>
    </li>
  );
}
