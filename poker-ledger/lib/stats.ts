// Ranking all-time e prémios do grupo. Funções puras: recebem sessões já carregadas, sem I/O.
import { MIN_SESSIONS_FOR_RATES } from "./config";
import { checkSession } from "./ledger";
import { formatCents } from "./money";

export type StatsEntryInput = {
  playerId: string;
  name: string;
  avatarColor: string;
  active: boolean;
  cashOut: number | null;
  adjustment: number;
  /** soma dos BuyIns (cêntimos) */
  buyInTotal: number;
  /** número de BuyIns (o primeiro é o buy-in inicial) */
  buyInCount: number;
};
export type StatsSessionInput = { id: string; date: Date; reconciled: boolean; players: readonly StatsEntryInput[] };

export type RankRow = {
  rank: number;
  playerId: string;
  name: string;
  avatarColor: string;
  active: boolean;
  sessions: number;
  profit: number;
  invested: number;
  wins: number;
  rebuys: number;
  /** cêntimos, arredondado; null abaixo de MIN_SESSIONS_FOR_RATES */
  avg: number | null;
  /** 0..1; null abaixo do mínimo */
  winRate: number | null;
  /** lucro / investido; null abaixo do mínimo */
  roi: number | null;
  best: { net: number; date: Date; sessionId: string } | null;
  worst: { net: number; date: Date; sessionId: string } | null;
};

export type AwardValue = { kind: "money" | "signedMoney" | "count" | "percent" | "days"; n: number; unit?: string };
export type AwardLine = {
  label?: string;
  /** null em prémios de sessão (ex.: Mesa de gala) */
  player: { id: string; name: string; avatarColor: string } | null;
  value: AwardValue;
  date: Date | null;
  sessionId: string | null;
};
export type AwardId =
  | "gold_night" | "nightmare" | "on_fire" | "free_fall" | "rebuy_king" | "comeback"
  | "no_net" | "rollercoaster" | "swiss_watch" | "pillar" | "ghost" | "gala";
export type Award = { id: AwardId; title: string; flavor: string; tone: "fame" | "shame"; main: AwardLine; extra?: AwardLine };

export type EvolutionSeries = { playerId: string; name: string; sessions: number; points: number[] };

export type Stats = {
  sessions: { id: string; date: Date }[];
  rows: RankRow[];
  awards: Award[];
  evolution: EvolutionSeries[];
  /** por defeito, os 5 jogadores com mais sessões */
  defaultLines: string[];
  /** soma dos lucros (tem de ser 0) */
  totalProfit: number;
};

export type StatsOptions = { from?: Date; to?: Date; now?: Date };

export const AWARD_META: Record<AwardId, { title: string; flavor: string; tone: "fame" | "shame" }> = {
  gold_night: { title: "Noite de ouro", flavor: "A noite em que a sorte pagou o jantar.", tone: "fame" },
  nightmare: { title: "Noite de pesadelo", flavor: "Há noites que é melhor nem contar.", tone: "shame" },
  on_fire: { title: "Em chamas", flavor: "Ganhar já é hábito.", tone: "fame" },
  free_fall: { title: "Em queda livre", flavor: "A gravidade também joga poker.", tone: "shame" },
  rebuy_king: { title: "Rei do rebuy", flavor: "A carteira dele é a banca da mesa.", tone: "shame" },
  comeback: { title: "Ressuscitado", flavor: "Rebuy, rebuy… e saiu a ganhar.", tone: "fame" },
  no_net: { title: "Sem rede", flavor: "Ganha sem nunca ir à carteira.", tone: "fame" },
  rollercoaster: { title: "Montanha-russa", flavor: "Ou tudo ou nada, nunca pelo meio.", tone: "shame" },
  swiss_watch: { title: "Relógio suíço", flavor: "Sempre certinho, noite após noite.", tone: "fame" },
  pillar: { title: "Pilar da mesa", flavor: "Se há mesa, está lá.", tone: "fame" },
  ghost: { title: "Fantasma", flavor: "Alguém o viu por aí?", tone: "shame" },
  gala: { title: "Mesa de gala", flavor: "A noite em que o pote engordou.", tone: "fame" },
};

const DAY = 86_400_000;
const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

type Entry = {
  idx: number; // posição da sessão no período (maior = mais recente)
  sessionId: string;
  date: Date;
  net: number;
  rebuys: number;
  invested: number;
};
type PlayerAcc = { id: string; name: string; avatarColor: string; active: boolean; entries: Entry[] };

/** Sessão válida: todos os cash-outs E (diferença 0 OU ajuste confirmado). */
export function isValidStatsSession(s: StatsSessionInput): boolean {
  if (s.players.length === 0) return false;
  return checkSession(
    s.players.map((p) => ({ playerId: p.playerId, cashOut: p.cashOut, adjustment: p.adjustment, buyIns: [p.buyInTotal] })),
    s.reconciled,
  ).valid;
}

/** Período por chave de URL: "sempre" (defeito), "ano", "90d". */
export type PeriodKey = "sempre" | "ano" | "90d";
export const PERIOD_LABELS: Record<PeriodKey, string> = { sempre: "Sempre", ano: "Este ano", "90d": "Últimos 90 dias" };
export function periodRange(key: PeriodKey, now: Date): { from?: Date } {
  if (key === "ano") return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) };
  if (key === "90d") {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return { from: new Date(today - 90 * DAY) };
  }
  return {};
}

/** Melhor candidato por pontuação; empate → o mais recente; depois pelo nome/id. */
function pick<T>(items: T[], score: (t: T) => number, recency: (t: T) => number, tie: (t: T) => string): T | undefined {
  let best: T | undefined;
  for (const it of items) {
    if (best === undefined) {
      best = it;
      continue;
    }
    const d = score(it) - score(best) || recency(it) - recency(best) || (tie(it) < tie(best) ? 1 : tie(it) > tie(best) ? -1 : 0);
    if (d > 0) best = it;
  }
  return best;
}

const who = (p: PlayerAcc) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor });
const last = (p: PlayerAcc) => p.entries[p.entries.length - 1];

function stdDev(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

/** Sequências de vitórias/derrotas consecutivas (nas sessões do jogador). Resultado 0 corta as duas. */
function streaks(p: PlayerAcc) {
  let win = 0, loss = 0;
  let bestWin = { len: 0, end: -1, date: null as Date | null, sessionId: null as string | null };
  let bestLoss = { ...bestWin };
  for (const e of p.entries) {
    if (e.net > 0) { win++; loss = 0; } else if (e.net < 0) { loss++; win = 0; } else { win = 0; loss = 0; }
    if (win > 0 && win >= bestWin.len) bestWin = { len: win, end: e.idx, date: e.date, sessionId: e.sessionId };
    if (loss > 0 && loss >= bestLoss.len) bestLoss = { len: loss, end: e.idx, date: e.date, sessionId: e.sessionId };
  }
  return { bestWin, bestLoss, activeWin: win };
}

export function computeStats(input: readonly StatsSessionInput[], opts: StatsOptions = {}): Stats {
  const now = opts.now ?? new Date();
  const sessions = input
    .filter((s) => (!opts.from || s.date >= opts.from) && (!opts.to || s.date <= opts.to))
    .filter(isValidStatsSession)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.date.getTime() - b.s.date.getTime() || a.i - b.i)
    .map(({ s }) => s);

  const players = new Map<string, PlayerAcc>();
  sessions.forEach((s, idx) => {
    for (const p of s.players) {
      let acc = players.get(p.playerId);
      if (!acc) {
        acc = { id: p.playerId, name: p.name, avatarColor: p.avatarColor, active: p.active, entries: [] };
        players.set(p.playerId, acc);
      }
      acc.entries.push({
        idx,
        sessionId: s.id,
        date: s.date,
        net: (p.cashOut ?? 0) - p.buyInTotal + p.adjustment,
        rebuys: Math.max(0, p.buyInCount - 1),
        invested: p.buyInTotal,
      });
    }
  });
  const all = [...players.values()];

  // ---------- Classificação ----------
  const rows: RankRow[] = all.map((p) => {
    const n = p.entries.length;
    const profit = p.entries.reduce((s, e) => s + e.net, 0);
    const invested = p.entries.reduce((s, e) => s + e.invested, 0);
    const wins = p.entries.filter((e) => e.net > 0).length;
    const enough = n >= MIN_SESSIONS_FOR_RATES;
    const b = pick(p.entries, (e) => e.net, (e) => e.idx, (e) => e.sessionId)!;
    const w = pick(p.entries, (e) => -e.net, (e) => e.idx, (e) => e.sessionId)!;
    return {
      rank: 0,
      playerId: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      active: p.active,
      sessions: n,
      profit,
      invested,
      wins,
      rebuys: p.entries.reduce((s, e) => s + e.rebuys, 0),
      avg: enough ? Math.round(profit / n) : null,
      winRate: enough ? wins / n : null,
      roi: enough && invested > 0 ? profit / invested : null,
      best: { net: b.net, date: b.date, sessionId: b.sessionId },
      worst: { net: w.net, date: w.date, sessionId: w.sessionId },
    };
  });
  rows.sort(
    (a, b) => b.profit - a.profit || b.profit / b.sessions - a.profit / a.sessions || a.name.localeCompare(b.name, "pt"),
  );
  rows.forEach((r, i) => (r.rank = i + 1));

  // ---------- Prémios ----------
  const awards: Award[] = [];
  const add = (id: AwardId, main: AwardLine | null, extra?: AwardLine | null) => {
    if (!main) return;
    awards.push({ id, ...AWARD_META[id], main, ...(extra ? { extra } : {}) });
  };
  const entries = all.flatMap((p) => p.entries.map((e) => ({ p, e })));
  const byEntry = (x: { p: PlayerAcc; e: Entry } | undefined, value: AwardValue, label?: string): AwardLine | null =>
    x ? { label, player: who(x.p), value, date: x.e.date, sessionId: x.e.sessionId } : null;
  const recE = (x: { e: Entry }) => x.e.idx;
  const tieE = (x: { p: PlayerAcc; e: Entry }) => x.p.name + x.p.id;

  // 1. Noite de ouro / 2. Noite de pesadelo
  const gold = pick(entries.filter((x) => x.e.net > 0), (x) => x.e.net, recE, tieE);
  add("gold_night", gold ? byEntry(gold, { kind: "signedMoney", n: gold.e.net }) : null);
  const night = pick(entries.filter((x) => x.e.net < 0), (x) => -x.e.net, recE, tieE);
  add("nightmare", night ? byEntry(night, { kind: "signedMoney", n: night.e.net }) : null);

  // 3. Em chamas / 4. Em queda livre (mínimo 2 seguidas)
  const st = all.map((p) => ({ p, ...streaks(p) }));
  const fire = pick(st.filter((x) => x.bestWin.len >= 2), (x) => x.bestWin.len, (x) => x.bestWin.end, (x) => x.p.name + x.p.id);
  const activeFire = pick(st.filter((x) => x.activeWin >= 2), (x) => x.activeWin, (x) => last(x.p).idx, (x) => x.p.name + x.p.id);
  add(
    "on_fire",
    fire ? { player: who(fire.p), value: { kind: "count", n: fire.bestWin.len, unit: pl(fire.bestWin.len, "vitória seguida", "vitórias seguidas") }, date: fire.bestWin.date, sessionId: fire.bestWin.sessionId } : null,
    activeFire
      ? { label: "Sequência ativa", player: who(activeFire.p), value: { kind: "count", n: activeFire.activeWin, unit: pl(activeFire.activeWin, "vitória seguida", "vitórias seguidas") }, date: last(activeFire.p).date, sessionId: last(activeFire.p).sessionId }
      : null,
  );
  const fall = pick(st.filter((x) => x.bestLoss.len >= 2), (x) => x.bestLoss.len, (x) => x.bestLoss.end, (x) => x.p.name + x.p.id);
  add(
    "free_fall",
    fall ? { player: who(fall.p), value: { kind: "count", n: fall.bestLoss.len, unit: pl(fall.bestLoss.len, "derrota seguida", "derrotas seguidas") }, date: fall.bestLoss.date, sessionId: fall.bestLoss.sessionId } : null,
  );

  // 5. Rei do rebuy: total e recorde numa só noite
  const rebuyTotals = all.map((p) => {
    const withRebuys = p.entries.filter((e) => e.rebuys > 0);
    return { p, n: withRebuys.reduce((s, e) => s + e.rebuys, 0), lastE: withRebuys[withRebuys.length - 1] };
  });
  const king = pick(rebuyTotals.filter((x) => x.n > 0), (x) => x.n, (x) => x.lastE.idx, (x) => x.p.name + x.p.id);
  const nightRecord = pick(entries.filter((x) => x.e.rebuys > 0), (x) => x.e.rebuys, recE, tieE);
  add(
    "rebuy_king",
    king ? { player: who(king.p), value: { kind: "count", n: king.n, unit: pl(king.n, "rebuy no total", "rebuys no total") }, date: king.lastE.date, sessionId: null } : null,
    byEntry(nightRecord, { kind: "count", n: nightRecord?.e.rebuys ?? 0, unit: pl(nightRecord?.e.rebuys ?? 0, "rebuy numa noite", "rebuys numa noite") }, "Recorde numa noite"),
  );

  // 6. Ressuscitado: maior ganho com ≥ 2 rebuys
  const comeback = pick(entries.filter((x) => x.e.rebuys >= 2 && x.e.net > 0), (x) => x.e.net, recE, tieE);
  add("comeback", comeback ? byEntry(comeback, { kind: "signedMoney", n: comeback.e.net }) : null);

  // 7. Sem rede: mais sessões ganhas sem rebuy
  const clean = all.map((p) => {
    const w = p.entries.filter((e) => e.net > 0 && e.rebuys === 0);
    return { p, n: w.length, lastE: w[w.length - 1] };
  });
  const noNet = pick(clean.filter((x) => x.n > 0), (x) => x.n, (x) => x.lastE.idx, (x) => x.p.name + x.p.id);
  add("no_net", noNet ? { player: who(noNet.p), value: { kind: "count", n: noNet.n, unit: pl(noNet.n, "vitória sem rebuy", "vitórias sem rebuy") }, date: noNet.lastE.date, sessionId: noNet.lastE.sessionId } : null);

  // 8. Montanha-russa / 9. Relógio suíço (desvio-padrão; ≥ MIN sessões e ≥ 2 candidatos)
  const vol = all
    .filter((p) => p.entries.length >= MIN_SESSIONS_FOR_RATES)
    .map((p) => ({ p, sd: stdDev(p.entries.map((e) => e.net)) }));
  if (vol.length >= 2) {
    const line = (x: { p: PlayerAcc; sd: number }): AwardLine => ({ player: who(x.p), value: { kind: "money", n: Math.round(x.sd), unit: "de desvio-padrão" }, date: last(x.p).date, sessionId: null });
    const hi = pick(vol, (x) => x.sd, (x) => last(x.p).idx, (x) => x.p.name + x.p.id)!;
    const lo = pick(vol, (x) => -x.sd, (x) => last(x.p).idx, (x) => x.p.name + x.p.id)!;
    add("rollercoaster", line(hi));
    add("swiss_watch", line(lo));
  }

  // 10. Pilar da mesa: maior presença
  if (sessions.length > 0) {
    const pillar = pick(all, (p) => p.entries.length, (p) => last(p).idx, (p) => p.name + p.id);
    if (pillar) {
      add("pillar", { player: who(pillar), value: { kind: "percent", n: pillar.entries.length / sessions.length, unit: `${pillar.entries.length} de ${sessions.length} ${pl(sessions.length, "sessão", "sessões")}` }, date: last(pillar).date, sessionId: null });
    }
  }

  // 11. Fantasma: ativo, falhou pelo menos a última sessão; há mais dias sem jogar
  const lastIdx = sessions.length - 1;
  const ghosts = all.filter((p) => p.active && last(p).idx < lastIdx);
  const ghost = pick(ghosts, (p) => -last(p).date.getTime(), () => 0, (p) => p.name + p.id);
  if (ghost) {
    const days = Math.max(0, Math.floor((now.getTime() - last(ghost).date.getTime()) / DAY));
    add("ghost", { player: who(ghost), value: { kind: "days", n: days }, date: last(ghost).date, sessionId: last(ghost).sessionId });
  }

  // 12. Mesa de gala: maior pote; e a sessão com mais rebuys
  const pots = sessions.map((s, idx) => ({
    s,
    idx,
    pot: s.players.reduce((a, p) => a + p.buyInTotal, 0),
    rebuys: s.players.reduce((a, p) => a + Math.max(0, p.buyInCount - 1), 0),
  }));
  const gala = pick(pots, (x) => x.pot, (x) => x.idx, (x) => x.s.id);
  const mostRebuys = pick(pots.filter((x) => x.rebuys > 0), (x) => x.rebuys, (x) => x.idx, (x) => x.s.id);
  add(
    "gala",
    gala ? { player: null, value: { kind: "money", n: gala.pot, unit: "de pote" }, date: gala.s.date, sessionId: gala.s.id } : null,
    mostRebuys ? { label: "Noite com mais rebuys", player: null, value: { kind: "count", n: mostRebuys.rebuys, unit: pl(mostRebuys.rebuys, "rebuy", "rebuys") }, date: mostRebuys.s.date, sessionId: mostRebuys.s.id } : null,
  );

  // ---------- Evolução (saldo acumulado por sessão, por ordem de data) ----------
  const evolution: EvolutionSeries[] = rows.map((r) => {
    const p = players.get(r.playerId)!;
    const byIdx = new Map(p.entries.map((e) => [e.idx, e.net]));
    let acc = 0;
    return { playerId: r.playerId, name: r.name, sessions: r.sessions, points: sessions.map((_, i) => (acc += byIdx.get(i) ?? 0)) };
  });
  const defaultLines = [...rows]
    .sort((a, b) => b.sessions - a.sessions || b.profit - a.profit || a.name.localeCompare(b.name, "pt"))
    .slice(0, 5)
    .map((r) => r.playerId);

  return {
    sessions: sessions.map((s) => ({ id: s.id, date: s.date })),
    rows,
    awards,
    evolution,
    defaultLines,
    totalProfit: rows.reduce((s, r) => s + r.profit, 0),
  };
}

// ---------- Ordenação da tabela ----------
export const SORT_KEYS = ["lucro", "sessoes", "media", "vitorias", "roi", "investido"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Ordena por coluna (decrescente); valores "—" (null) vão para o fim; desempate pela posição. */
export function sortRows(rows: readonly RankRow[], key: SortKey): RankRow[] {
  const val = (r: RankRow): number | null =>
    key === "lucro" ? r.profit : key === "sessoes" ? r.sessions : key === "media" ? r.avg : key === "vitorias" ? r.winRate : key === "roi" ? r.roi : r.invested;
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va === null && vb === null) return a.rank - b.rank;
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va || a.rank - b.rank;
  });
}

// ---------- Texto para WhatsApp ----------
const signed = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${formatCents(c)}`;
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

export function shareText(stats: Stats, periodLabel: string): string {
  const lines = [`♠️ *Ranking do poker* (${periodLabel})`, ""];
  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  stats.rows.slice(0, 5).forEach((r, i) => lines.push(`${medals[i]} ${r.name}: ${signed(r.profit)}`));
  const star = stats.awards.find((a) => a.id === "gold_night") ?? stats.awards[0];
  if (star) {
    const v = star.main.value;
    const val = v.kind === "signedMoney" ? signed(v.n) : v.kind === "money" ? formatCents(v.n) : `${v.n}${v.unit ? ` ${v.unit}` : ""}`;
    lines.push("", `🏆 ${star.title}: ${star.main.player?.name ?? "sessão"} (${val}${star.main.date ? `, ${ddmm(star.main.date)}` : ""})`);
  }
  return lines.join("\n").replace(/ /g, " ");
}
