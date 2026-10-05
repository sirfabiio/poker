import { describe, expect, it } from "vitest";
import {
  BACKOFF_MAX_MS,
  baseDelay,
  createPoller,
  FAST_MS,
  IDLE_AFTER_MS,
  noticeText,
  onInteraction,
  onRefreshDone,
  onResult,
  onSeen,
  onVisibility,
  onWake,
  SLOW_MS,
  tick,
  withJitter,
  type PollerState,
  type SessionVersion,
  type Step,
} from "@/lib/live/poller";

const ME = "me";
const info = (version: number, extra: Partial<SessionVersion> = {}): SessionVersion => ({
  version,
  lastActorPlayerId: "rui",
  lastChangeType: "rebuy_added",
  settled: false,
  ...extra,
});

/**
 * Relógio simulado + "servidor" falso: corre a máquina de estados como o componente a corre
 * (o temporizador dispara tick; cada pedido termina com onResult).
 */
function sim(start = 0) {
  let now = start;
  let s: PollerState = createPoller({ version: 1, me: ME, now, visible: true, online: true });
  let timerAt: number | null = now + FAST_MS;
  const requests: number[] = [];
  const refreshes: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const apply = (st: Step) => {
    s = st.state;
    if (st.delay === null) timerAt = null;
    else if (st.delay !== undefined) timerAt = now + st.delay;
    if (st.fetch) {
      requests.push(now);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
    }
    if (st.refresh) refreshes.push(now);
    return st;
  };
  return {
    get s() {
      return s;
    },
    get timerAt() {
      return timerAt;
    },
    requests,
    refreshes,
    get maxInFlight() {
      return maxInFlight;
    },
    /** avança o relógio até ao próximo disparo do temporizador e faz o tick */
    fire() {
      if (timerAt === null) throw new Error("sem temporizador");
      now = timerAt;
      return apply(tick(s));
    },
    respond(r: Parameters<typeof onResult>[2]) {
      inFlight--;
      return apply(onResult(s, now, r));
    },
    at(t: number) {
      now = t;
    },
    get now() {
      return now;
    },
    apply,
  };
}

describe("poller: cadência", () => {
  it("pergunta a cada 3 s enquanto não há alterações", () => {
    const p = sim();
    for (let i = 0; i < 5; i++) {
      p.fire();
      p.respond({ ok: true, info: info(1) });
    }
    expect(p.requests).toEqual([3000, 6000, 9000, 12000, 15000]);
    expect(p.refreshes).toEqual([]);
  });

  it("passa a 10 s após 5 min sem alterações nem interação, e volta a 3 s numa alteração", () => {
    const p = sim();
    while (p.now < IDLE_AFTER_MS) {
      p.fire();
      p.respond({ ok: true, info: info(1) });
    }
    expect(p.timerAt! - p.now).toBe(SLOW_MS);
    p.fire();
    const step = p.respond({ ok: true, info: info(2) });
    expect(step.refresh).toBe(true);
    expect(p.timerAt! - p.now).toBe(FAST_MS);
  });

  it("uma interação repõe 3 s e troca o temporizador de 10 s em curso", () => {
    const p = sim();
    while (p.now < IDLE_AFTER_MS) {
      p.fire();
      p.respond({ ok: true, info: info(1) });
    }
    expect(baseDelay(p.s, p.now)).toBe(SLOW_MS);
    p.at(p.now + 1000);
    const st = p.apply(onInteraction(p.s, p.now));
    expect(st.delay).toBe(FAST_MS);
    expect(baseDelay(p.s, p.now)).toBe(FAST_MS);
    // interação sem estar parado: não mexe no temporizador
    expect(onInteraction(p.s, p.now + 10).delay).toBeUndefined();
  });

  it("backoff em erros 3 → 6 → 12 → 24 → 30 s (máximo) e volta a 3 s no primeiro sucesso", () => {
    const p = sim();
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      p.fire();
      p.respond({ ok: false });
      delays.push(p.timerAt! - p.now);
    }
    expect(delays).toEqual([3000, 6000, 12000, 24000, BACKOFF_MAX_MS, BACKOFF_MAX_MS]);
    expect(p.s.status).toBe("reconnecting");
    p.fire();
    p.respond({ ok: true, info: info(1) });
    expect(p.timerAt! - p.now).toBe(FAST_MS);
    expect(p.s.status).toBe("live");
  });

  it("erro sem rede mostra 'offline'", () => {
    const p = sim();
    p.apply({ state: { ...p.s, online: false } });
    p.fire();
    p.respond({ ok: false });
    expect(p.s.status).toBe("offline");
  });

  it("jitter de ±300 ms", () => {
    expect(withJitter(3000, 0)).toBe(2700);
    expect(withJitter(3000, 0.5)).toBe(3000);
    expect(withJitter(3000, 0.9999)).toBe(3300);
  });
});

describe("poller: visibilidade e eventos", () => {
  it("pausa com a página oculta e verifica logo ao ficar visível", () => {
    const p = sim();
    p.apply(onVisibility(p.s, false));
    expect(p.timerAt).toBeNull();
    expect(tick(p.s).fetch).toBeUndefined();
    p.at(60_000);
    const st = p.apply(onVisibility(p.s, true));
    expect(st.fetch).toBe(true);
    expect(p.requests).toEqual([60_000]);
  });

  it("um pedido que termina com a página oculta não agenda outro", () => {
    const p = sim();
    p.fire();
    p.apply(onVisibility(p.s, false));
    p.respond({ ok: true, info: info(1) });
    expect(p.timerAt).toBeNull();
  });

  it("focus/online fazem uma verificação imediata", () => {
    const p = sim();
    p.at(1000);
    expect(p.apply(onWake(p.s)).fetch).toBe(true);
    p.respond({ ok: true, info: info(1) });
    p.at(1500);
    expect(p.apply(onWake(p.s, true)).fetch).toBe(true);
  });

  it("nunca dois pedidos em simultâneo: verificação pedida a meio fica para logo a seguir", () => {
    const p = sim();
    p.fire();
    expect(p.apply(onWake(p.s)).fetch).toBeUndefined();
    expect(p.apply(onVisibility(p.s, true)).fetch).toBeUndefined();
    expect(p.maxInFlight).toBe(1);
    const st = p.respond({ ok: true, info: info(1) });
    expect(st.delay).toBe(0);
    p.fire();
    expect(p.requests).toHaveLength(2);
    expect(p.maxInFlight).toBe(1);
  });
});

describe("poller: decisões", () => {
  it("versão maior: um refresh e aviso com o autor; alteração própria sem aviso", () => {
    const p = sim();
    p.fire();
    const a = p.respond({ ok: true, info: info(2) });
    expect(a.refresh).toBe(true);
    expect(a.notice).toEqual({ actorPlayerId: "rui", type: "rebuy_added" });
    p.apply(onRefreshDone(p.s));
    p.fire();
    const b = p.respond({ ok: true, info: info(3, { lastActorPlayerId: ME }) });
    expect(b.refresh).toBe(true);
    expect(b.notice).toBeUndefined();
  });

  it("um refresh de cada vez: versão nova durante um refresh fica em fila", () => {
    const p = sim();
    p.fire();
    p.respond({ ok: true, info: info(2) });
    p.fire();
    const b = p.respond({ ok: true, info: info(3) });
    expect(b.refresh).toBe(false);
    const done = p.apply(onRefreshDone(p.s));
    expect(done.refresh).toBe(true);
    expect(p.apply(onRefreshDone(p.s)).refresh).toBeUndefined();
    expect(p.refreshes).toHaveLength(2);
  });

  it("versão já vista (dados da minha própria ação) não faz refresh", () => {
    const p = sim();
    p.apply({ state: onSeen(p.s, 5) });
    p.fire();
    expect(p.respond({ ok: true, info: info(5) }).refresh).toBeUndefined();
  });

  it("sessão fechada: último refresh e para", () => {
    const p = sim();
    p.fire();
    const st = p.respond({ ok: true, info: info(2, { settled: true, lastChangeType: "session_settled" }) });
    expect(st.refresh).toBe(true);
    expect(p.s.status).toBe("settled");
    expect(p.timerAt).toBeNull();
    expect(tick(p.s).fetch).toBeUndefined();
  });

  it("401 para; 404 refresca uma vez e para", () => {
    const a = sim();
    a.fire();
    a.respond({ ok: false, status: 401 });
    expect(a.s.status).toBe("stopped");
    expect(a.timerAt).toBeNull();
    expect(a.refreshes).toEqual([]);
    const b = sim();
    b.fire();
    const st = b.respond({ ok: false, status: 404 });
    expect(st.refresh).toBe(true);
    expect(b.timerAt).toBeNull();
    expect(onWake(b.s).fetch).toBeUndefined();
  });

  it("texto do aviso", () => {
    expect(noticeText("Rui", "rebuy_added")).toBe("Rui adicionou um rebuy");
    expect(noticeText(null, "cashout_set")).toBe("Alguém atualizou um cash-out");
  });
});
