import Link from "next/link";
import type { Award, AwardLine, AwardValue } from "@/lib/stats";
import { formatDay } from "@/lib/format";
import { Chip } from "./Chip";
import { Money } from "./Money";

function Value({ v }: { v: AwardValue }) {
  if (v.kind === "signedMoney") return <Money cents={v.n} signed className="font-semibold" />;
  if (v.kind === "money")
    return (
      <span>
        <Money cents={v.n} className="font-semibold" /> {v.unit}
      </span>
    );
  if (v.kind === "percent")
    return (
      <span>
        <strong className="money">{Math.round(v.n * 100)} %</strong> {v.unit ? `(${v.unit})` : ""}
      </span>
    );
  if (v.kind === "days")
    return (
      <span>
        há <strong className="money">{v.n}</strong> {v.n === 1 ? "dia" : "dias"}
      </span>
    );
  return (
    <span>
      <strong className="money">{v.n}</strong> {v.unit}
    </span>
  );
}

function Line({ line, small = false }: { line: AwardLine; small?: boolean }) {
  const date = line.date ? formatDay(line.date) : null;
  const name = line.player?.name ?? (date ? `Sessão de ${date}` : "Sessão");
  return (
    <div className="flex items-center gap-3">
      {line.player ? (
        <Chip name={line.player.name} color={line.player.avatarColor} size="sm" />
      ) : (
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/40 text-gold-soft">
          ♠{"︎"}
        </span>
      )}
      <div className={`min-w-0 ${small ? "text-sm" : ""}`}>
        {line.label && <p className="text-[13px] text-ivory/75">{line.label}</p>}
        <p className="truncate font-semibold">{name}</p>
        <p className="text-[14px] text-ivory/90">
          <Value v={line.value} />
          {line.player && date && (
            <span className="text-[13px] text-ivory/75">
              {" · "}
              {line.sessionId ? (
                <Link href={`/sessoes/${line.sessionId}`} className="underline underline-offset-2">
                  {date}
                </Link>
              ) : (
                `última: ${date}`
              )}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** Cartão de prémio (Hall of Fame / Hall of Shame). */
export function AwardCard({ award }: { award: Award }) {
  const fame = award.tone === "fame";
  return (
    <article className="glass rounded-[24px] p-4">
      <p className={`text-[13px] font-semibold tracking-wide uppercase ${fame ? "text-gold-soft" : "text-loss-soft"}`}>
        {fame ? "Hall of Fame" : "Hall of Shame"}
      </p>
      <h3 className="font-display text-[20px] font-semibold">{award.title}</h3>
      <p className="mb-3 text-[13px] text-ivory/75 italic">{award.flavor}</p>
      <Line line={award.main} />
      {award.extra && (
        <div className="mt-3 border-t border-dashed border-white/20 pt-3">
          <Line line={award.extra} small />
        </div>
      )}
    </article>
  );
}
