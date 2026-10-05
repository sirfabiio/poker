import type { Metadata } from "next";
import Link from "next/link";
import { requireViewerPage } from "@/lib/identity";
import { getStatsSessions } from "@/lib/queries";
import { computeStats, periodRange, PERIOD_LABELS, shareText, sortRows, SORT_KEYS, type PeriodKey, type SortKey } from "@/lib/stats";
import { formatDay } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { RankTable } from "@/components/ui/RankTable";
import { AwardCard } from "@/components/ui/AwardCard";
import { EvolutionChart, CHART_COLORS } from "@/components/ui/EvolutionChart";
import { Podium } from "@/components/Podium";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { ShareRankingButton } from "@/components/ShareRankingButton";

export const metadata: Metadata = { title: "Ranking" };

const MAX_LINES = 8;
const PERIODS = Object.keys(PERIOD_LABELS) as PeriodKey[];

type Q = { periodo?: string; ordem?: string; linhas?: string };

export default async function Ranking({ searchParams }: { searchParams: Promise<Q> }) {
  await requireViewerPage();
  const sp = await searchParams;
  const period: PeriodKey = PERIODS.includes(sp.periodo as PeriodKey) ? (sp.periodo as PeriodKey) : "sempre";
  const sort: SortKey = SORT_KEYS.includes(sp.ordem as SortKey) ? (sp.ordem as SortKey) : "lucro";
  const now = new Date();
  const stats = computeStats(await getStatsSessions(), { ...periodRange(period, now), now });

  const known = new Set(stats.evolution.map((s) => s.playerId));
  const asked = sp.linhas?.split(",").filter((id) => known.has(id)) ?? null;
  const lines = (asked ?? stats.defaultLines).slice(0, MAX_LINES);

  const href = (q: { periodo?: PeriodKey; ordem?: SortKey; linhas?: string[] }) => {
    const p = q.periodo ?? period;
    const o = q.ordem ?? sort;
    const l = q.linhas ?? (asked ? lines : null);
    const u = new URLSearchParams();
    if (p !== "sempre") u.set("periodo", p);
    if (o !== "lucro") u.set("ordem", o);
    if (l) u.set("linhas", l.join(","));
    const s = u.toString();
    return s ? `/ranking?${s}` : "/ranking";
  };

  const chips = [...stats.evolution].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "pt"));
  const visible = lines.map((id) => stats.evolution.find((s) => s.playerId === id)!).filter(Boolean);
  const empty = stats.rows.length === 0;

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] font-semibold">Ranking</h1>
        {!empty && <ShareRankingButton text={shareText(stats, PERIOD_LABELS[period])} />}
      </header>

      <nav aria-label="Período" className="mb-4 flex gap-1.5 overflow-x-auto">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={href({ periodo: p, linhas: undefined })}
            scroll={false}
            aria-current={p === period ? "page" : undefined}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${
              p === period ? "bg-gold-soft text-ink" : "glass text-ivory"
            }`}
          >
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </nav>

      {empty ? (
        <Card>
          <EmptyState>Ainda não há sessões completas neste período. O ranking começa à próxima mesa!</EmptyState>
        </Card>
      ) : (
        <>
          <Card>
            <Podium top={stats.rows.slice(0, 3).map((r) => ({ id: r.playerId, name: r.name, balance: r.profit }))} />
            <p className="mt-3 text-center text-[13px] text-ivory/75">
              {stats.sessions.length} {stats.sessions.length === 1 ? "sessão" : "sessões"} válidas · {PERIOD_LABELS[period].toLowerCase()}
            </p>
          </Card>

          <SectionTitle>Classificação</SectionTitle>
          <RankTable rows={sortRows(stats.rows, sort)} sort={sort} hrefFor={(k) => href({ ordem: k })} />
          <p className="mt-2 text-[13px] text-ivory/75">“—”: menos de 3 sessões. Toca no título de uma coluna para ordenar.</p>
        </>
      )}

      <SectionTitle>Evolução</SectionTitle>
      {stats.sessions.length < 3 ? (
        <Card>
          <EmptyState>São precisas pelo menos 3 sessões para desenhar a evolução. Mais umas mãos e já está!</EmptyState>
        </Card>
      ) : (
        <Card>
          <EvolutionChart
            series={visible}
            labels={{ first: formatDay(stats.sessions[0].date), last: formatDay(stats.sessions[stats.sessions.length - 1].date) }}
          />
          <ul aria-label="Jogadores no gráfico" className="mt-3 flex flex-wrap gap-2">
            {chips.map((s) => {
              const i = lines.indexOf(s.playerId);
              const on = i >= 0;
              const next = on ? lines.filter((id) => id !== s.playerId) : [...lines, s.playerId];
              const full = !on && lines.length >= MAX_LINES;
              const cls = "inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm";
              const dot = (
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border"
                  style={on ? { background: CHART_COLORS[i % CHART_COLORS.length], borderColor: "transparent" } : { borderColor: "rgba(245,241,230,.5)" }}
                />
              );
              return (
                <li key={s.playerId}>
                  {full ? (
                    <span aria-disabled="true" className={`${cls} glass opacity-50`}>
                      {dot}
                      {s.name}
                    </span>
                  ) : (
                    <Link
                      href={href({ linhas: next })}
                      scroll={false}
                      aria-label={`${on ? "Esconder" : "Mostrar"} ${s.name} no gráfico`}
                      className={`${cls} ${on ? "bg-ink/50 font-semibold" : "glass text-ivory/80"}`}
                    >
                      {dot}
                      {s.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[13px] text-ivory/75">Máximo de {MAX_LINES} linhas. Eixo horizontal: sessões por ordem de data.</p>
        </Card>
      )}

      <SectionTitle>Prémios e recordes</SectionTitle>
      {stats.awards.length === 0 ? (
        <Card>
          <EmptyState>Ainda não há prémios para entregar. A glória (e a vergonha) esperam por vocês.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.awards.map((a) => (
            <AwardCard key={a.id} award={a} />
          ))}
        </div>
      )}
    </>
  );
}
