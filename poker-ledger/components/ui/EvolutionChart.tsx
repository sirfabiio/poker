import type { EvolutionSeries } from "@/lib/stats";
import { formatCents } from "@/lib/money";

/** Cores das linhas: claras e distintas sobre o feltro (o nome no fim de cada linha evita depender só da cor). */
export const CHART_COLORS = ["#F0D98A", "#3DDC97", "#8FB0FF", "#FFA3AC", "#F5F1E6", "#D3B0FF", "#FFC27A", "#7FE3E3"];

const W = 340;
const H = 220;
const PAD = { l: 6, r: 74, t: 22, b: 26 };

const short = (s: string) => (s.length > 9 ? `${s.slice(0, 8)}…` : s);
const eur = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${formatCents(c).replace(/ /g, " ")}`;

/** Saldo acumulado por sessão, em SVG gerado no servidor (sem biblioteca, sem JS). */
export function EvolutionChart({ series, labels }: { series: EvolutionSeries[]; labels: { first: string; last: string } }) {
  const n = series[0]?.points.length ?? 0;
  const values = series.flatMap((s) => s.points);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, n - 1);
  const y = (v: number) => PAD.t + ((max - v) * (H - PAD.t - PAD.b)) / span;

  // Etiquetas no fim de cada linha, afastadas umas das outras para não se sobreporem.
  const ends = series
    .map((s, i) => ({ i, y: y(s.points[n - 1]) }))
    .sort((a, b) => a.y - b.y);
  const GAP = 15;
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + GAP);
  const overflow = ends.length ? ends[ends.length - 1].y - (H - PAD.b + 4) : 0;
  if (overflow > 0) for (const e of ends) e.y -= overflow;
  for (let k = ends.length - 2; k >= 0; k--) ends[k].y = Math.min(ends[k].y, ends[k + 1].y - GAP);
  const labelY = new Map(ends.map((e) => [e.i, e.y]));

  const summary = series.map((s) => `${s.name} ${eur(s.points[n - 1])}`).join(", ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolução do saldo acumulado ao longo de ${n} sessões: ${summary}.`} className="block h-auto w-full">
      <text x={PAD.l} y={13} fontSize="13" fill="rgba(245,241,230,.75)">
        {eur(max)}
      </text>
      <text x={PAD.l} y={H - PAD.b - 4} fontSize="13" fill="rgba(245,241,230,.75)">
        {eur(min)}
      </text>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="rgba(245,241,230,.35)" strokeDasharray="4 4" />
      {series.map((s, i) => (
        <g key={s.playerId}>
          <polyline
            points={s.points.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={x(n - 1)} cy={y(s.points[n - 1])} r="3" fill={CHART_COLORS[i % CHART_COLORS.length]} />
          <text x={x(n - 1) + 7} y={(labelY.get(i) ?? 0) + 4.5} fontSize="13" fontWeight="600" fill={CHART_COLORS[i % CHART_COLORS.length]}>
            {short(s.name)}
          </text>
        </g>
      ))}
      <text x={PAD.l} y={H - 6} fontSize="13" fill="rgba(245,241,230,.75)">
        {labels.first}
      </text>
      <text x={W - PAD.r} y={H - 6} fontSize="13" fill="rgba(245,241,230,.75)" textAnchor="end">
        {labels.last}
      </text>
    </svg>
  );
}
