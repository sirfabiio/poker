// Máquina de estados da verificação de versão da página de sessão (sem DOM, sem relógio próprio: `now` vem de fora).
// O componente (components/session/LiveSession.tsx) só executa os efeitos: pedir, agendar, refrescar, avisar.

export const FAST_MS = 3_000;
export const SLOW_MS = 10_000;
export const IDLE_AFTER_MS = 5 * 60_000;
export const BACKOFF_MAX_MS = 30_000;
export const REQUEST_TIMEOUT_MS = 4_000;
export const JITTER_MS = 300;

/** Resposta de GET /api/sessions/[id]/version. */
export type SessionVersion = {
  version: number;
  lastActorPlayerId: string | null;
  lastChangeType: string | null;
  settled: boolean;
};

export type LiveStatus = "live" | "reconnecting" | "offline" | "stopped" | "settled";

export type PollerState = {
  known: number;
  me: string;
  visible: boolean;
  online: boolean;
  inFlight: boolean;
  /** pedida uma verificação imediata enquanto havia um pedido em curso */
  checkQueued: boolean;
  errors: number;
  /** última alteração ou interação (para passar a 10 s) */
  lastActivity: number;
  refreshing: boolean;
  refreshQueued: boolean;
  status: LiveStatus;
};

export type Notice = { actorPlayerId: string; type: string | null };

/**
 * Efeitos a executar. `delay`: agendar a próxima verificação daqui a N ms (sem jitter); null = cancelar o que estiver
 * agendado; undefined = deixar como está.
 */
export type Step = {
  state: PollerState;
  fetch?: boolean;
  delay?: number | null;
  refresh?: boolean;
  notice?: Notice | null;
};

export type FetchResult = { ok: true; info: SessionVersion } | { ok: false; status?: number };

export function createPoller(o: { version: number; me: string; now: number; visible: boolean; online: boolean; settled?: boolean }): PollerState {
  return {
    known: o.version,
    me: o.me,
    visible: o.visible,
    online: o.online,
    inFlight: false,
    checkQueued: false,
    errors: 0,
    lastActivity: o.now,
    refreshing: false,
    refreshQueued: false,
    status: o.settled ? "settled" : o.online ? "live" : "offline",
  };
}

export const isStopped = (s: PollerState) => s.status === "stopped" || s.status === "settled";

/** Espera até à próxima verificação: backoff em erro, 10 s se parado há 5 min, senão 3 s. */
export function baseDelay(s: PollerState, now: number): number {
  if (s.errors > 0) return Math.min(FAST_MS * 2 ** (s.errors - 1), BACKOFF_MAX_MS);
  return now - s.lastActivity >= IDLE_AFTER_MS ? SLOW_MS : FAST_MS;
}

/** ±300 ms para os vários telemóveis não perguntarem todos ao mesmo tempo. `rand` ∈ [0, 1). */
export const withJitter = (ms: number, rand: number) => Math.max(0, ms + Math.round((rand * 2 - 1) * JITTER_MS));

/** Hora de verificar (temporizador ou pedido imediato). Nunca dois pedidos em simultâneo. */
export function tick(s: PollerState): Step {
  if (isStopped(s) || !s.visible) return { state: s, delay: null };
  if (s.inFlight) return { state: { ...s, checkQueued: true }, delay: null };
  return { state: { ...s, inFlight: true, checkQueued: false }, fetch: true, delay: null };
}

function askRefresh(s: PollerState): { state: PollerState; refresh: boolean } {
  if (s.refreshing) return { state: { ...s, refreshQueued: true }, refresh: false };
  return { state: { ...s, refreshing: true }, refresh: true };
}

/** Resultado do pedido de versão. */
export function onResult(prev: PollerState, now: number, r: FetchResult): Step {
  let s: PollerState = { ...prev, inFlight: false };
  if (!r.ok && (r.status === 401 || r.status === 404)) {
    // Sem perfil ou sessão apagada: para. Na 404 refresca uma vez para a página mostrar "não encontrada".
    s = { ...s, status: "stopped", checkQueued: false };
    if (r.status === 404) {
      const a = askRefresh(s);
      return { state: a.state, refresh: a.refresh, delay: null };
    }
    return { state: s, delay: null };
  }
  if (!r.ok) {
    s = { ...s, errors: s.errors + 1, status: s.online ? "reconnecting" : "offline" };
    return next(s, now, {});
  }
  s = { ...s, errors: 0, online: true, status: "live" };
  const out: Omit<Step, "state"> = {};
  if (r.info.version > s.known || r.info.settled) {
    if (r.info.version > s.known) {
      s = { ...s, known: r.info.version, lastActivity: now };
      if (r.info.lastActorPlayerId && r.info.lastActorPlayerId !== s.me) {
        out.notice = { actorPlayerId: r.info.lastActorPlayerId, type: r.info.lastChangeType };
      }
    }
    const a = askRefresh(s);
    s = a.state;
    out.refresh = a.refresh;
  }
  if (r.info.settled) return { ...out, state: { ...s, status: "settled", checkQueued: false }, delay: null };
  return next(s, now, out);
}

function next(s: PollerState, now: number, out: Omit<Step, "state">): Step {
  if (isStopped(s) || !s.visible) return { ...out, state: { ...s, checkQueued: false }, delay: null };
  if (s.checkQueued) return { ...out, state: { ...s, checkQueued: false }, delay: 0 };
  return { ...out, state: s, delay: baseDelay(s, now) };
}

/** O router.refresh() terminou; se chegou outra versão entretanto, faz mais um (sempre um de cada vez). */
export function onRefreshDone(s: PollerState): Step {
  if (s.refreshQueued) return { state: { ...s, refreshQueued: false, refreshing: true }, refresh: true };
  return { state: { ...s, refreshing: false } };
}

/** Página visível/oculta. Ao ficar visível verifica logo; oculta, para de perguntar. */
export function onVisibility(s: PollerState, visible: boolean): Step {
  if (!visible) return { state: { ...s, visible: false }, delay: null };
  return tick({ ...s, visible: true });
}

/** `focus` ou `online`: verificação imediata. */
export function onWake(s: PollerState, online = s.online): Step {
  return tick({ ...s, online, status: !isStopped(s) && online && s.status === "offline" ? "reconnecting" : s.status });
}

export function onOffline(s: PollerState): Step {
  return { state: { ...s, online: false, status: isStopped(s) ? s.status : "offline" } };
}

/** Toque/tecla: volta a 3 s. Devolve `delay` se o temporizador em curso (10 s) deve ser trocado. */
export function onInteraction(s: PollerState, now: number): Step {
  const wasIdle = baseDelay(s, now) === SLOW_MS;
  const state = { ...s, lastActivity: now };
  return { state, delay: wasIdle && !s.inFlight && !isStopped(s) && s.visible ? FAST_MS : undefined };
}

/** A página recebeu dados mais recentes (ex.: depois de uma ação minha): não é preciso refrescar por essa versão. */
export function onSeen(s: PollerState, version: number): PollerState {
  return version > s.known ? { ...s, known: version } : s;
}

const VERBS: Record<string, string> = {
  rebuy_added: "adicionou um rebuy",
  rebuy_removed: "removeu uma entrada",
  cashout_set: "atualizou um cash-out",
  player_added: "juntou jogadores à sessão",
  player_removed: "tirou um jogador da sessão",
  session_edited: "editou a sessão",
  adjustment_confirmed: "ajustou a diferença de contagem",
  adjustment_undone: "desfez o ajuste de contagem",
  session_settled: "fechou as contas",
};

export function noticeText(name: string | null, type: string | null): string {
  return `${name ?? "Alguém"} ${(type && VERBS[type]) || "alterou a sessão"}`;
}
