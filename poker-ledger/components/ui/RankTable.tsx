import Link from "next/link";
import type { RankRow, SortKey } from "@/lib/stats";
import { Chip } from "./Chip";
import { Money } from "./Money";

const COLS: { key: SortKey; label: string }[] = [
  { key: "sessoes", label: "Sessões" },
  { key: "lucro", label: "Lucro" },
  { key: "media", label: "Média" },
  { key: "vitorias", label: "% ganhas" },
  { key: "roi", label: "ROI" },
  { key: "investido", label: "Investido" },
];

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

/** Classificação: ordenável por coluna através de links (sem JS); "—" abaixo do mínimo de sessões. */
export function RankTable({ rows, sort, hrefFor }: { rows: RankRow[]; sort: SortKey; hrefFor: (k: SortKey) => string }) {
  return (
    <div className="glass overflow-x-auto overscroll-x-contain rounded-[24px]">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <caption className="sr-only">Classificação dos jogadores, ordenada por {COLS.find((c) => c.key === sort)?.label}</caption>
        <thead>
          <tr className="text-left text-[13px] text-ivory/75">
            <th scope="col" className="sticky left-0 z-10 bg-felt-700 py-3 pr-2 pl-4 font-medium">
              #
            </th>
            <th scope="col" className="sticky left-10 z-10 bg-felt-700 px-2 py-3 font-medium">
              Jogador
            </th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort === c.key ? "descending" : undefined} className="px-2 py-3 text-right font-medium">
                <Link href={hrefFor(c.key)} scroll={false} className={`inline-flex min-h-9 items-center ${sort === c.key ? "font-semibold text-gold-soft" : ""}`}>
                  {c.label}
                  {sort === c.key && <span aria-hidden="true"> ↓</span>}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId} className="border-t border-white/10">
              <td className="sticky left-0 bg-felt-700 py-2.5 pr-2 pl-4 text-ivory/80 tabular-nums">{r.rank}</td>
              <th scope="row" className="sticky left-10 bg-felt-700 px-2 py-2.5 text-left font-semibold">
                <span className="flex items-center gap-2">
                  <Chip name={r.name} color={r.avatarColor} size="sm" />
                  <span className="max-w-[7.5rem] truncate">{r.name}</span>
                </span>
                {!r.active && <span className="mt-0.5 block text-[13px] font-normal text-ivory/70">ex-jogador</span>}
              </th>
              <td className="px-2 text-right tabular-nums">{r.sessions}</td>
              <td className="px-2 text-right">
                <Money cents={r.profit} signed size="sm" className="justify-end font-semibold" />
              </td>
              <td className="px-2 text-right">{r.avg === null ? "—" : <Money cents={r.avg} signed size="sm" className="justify-end" />}</td>
              <td className="px-2 text-right tabular-nums">{pct(r.winRate)}</td>
              <td className="px-2 text-right tabular-nums">{pct(r.roi)}</td>
              <td className="px-2 pr-4 text-right">
                <Money cents={r.invested} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
