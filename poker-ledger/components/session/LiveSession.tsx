"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createPoller,
  FAST_MS,
  noticeText,
  onInteraction,
  onOffline,
  onRefreshDone,
  onResult,
  onSeen,
  onVisibility,
  onWake,
  REQUEST_TIMEOUT_MS,
  tick,
  withJitter,
  type FetchResult,
  type LiveStatus,
  type PollerState,
  type Step,
} from "@/lib/live/poller";
import { LiveActorContext } from "./live-field";

const LABEL: Partial<Record<LiveStatus, string>> = {
  live: "Atualizado agora",
  reconnecting: "A reconectar…",
  offline: "Sem ligação",
  settled: "Sessão fechada nas contas",
};

/**
 * Mantém a página da sessão atualizada: pergunta a versão (GET /api/sessions/[id]/version) a cada 3 s com a página
 * visível e só faz router.refresh() quando mudou. Decisões de cadência em lib/live/poller.ts.
 */
export function LiveSession({
  sessionId,
  version,
  viewerId,
  names,
  settled,
  children,
}: {
  sessionId: string;
  version: number;
  viewerId: string;
  /** playerId → nome, para o aviso "Rui adicionou um rebuy" */
  names: Record<string, string>;
  /** sessão já fechada nas contas: não há nada para acompanhar */
  settled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [status, setStatus] = useState<LiveStatus>(settled ? "settled" : "live");
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const p = useRef<PollerState | null>(null);
  const run = useRef<(step: Step) => void>(() => {});
  const namesRef = useRef(names);
  namesRef.current = names;
  const wasRefreshing = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const url = `/api/sessions/${encodeURIComponent(sessionId)}/version`;

    const check = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      let r: FetchResult;
      try {
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        r = res.ok ? { ok: true, info: await res.json() } : { ok: false, status: res.status };
      } catch {
        r = { ok: false };
      } finally {
        clearTimeout(t);
      }
      if (alive && p.current) run.current(onResult(p.current, Date.now(), r));
    };

    run.current = (step: Step) => {
      p.current = step.state;
      setStatus(step.state.status);
      if (step.notice) {
        const name = namesRef.current[step.notice.actorPlayerId] ?? null;
        setActor(name);
        setToast((t) => ({ text: noticeText(name, step.notice!.type), n: (t?.n ?? 0) + 1 }));
      }
      if (step.refresh) startRefresh(() => router.refresh());
      if (step.delay === null) clearTimeout(timer);
      else if (step.delay !== undefined) {
        clearTimeout(timer);
        const ms = step.delay === 0 ? 0 : withJitter(step.delay, Math.random());
        timer = setTimeout(() => p.current && run.current(tick(p.current)), ms);
      }
      if (step.fetch) void check();
    };

    const visible = () => document.visibilityState === "visible";
    p.current = createPoller({ version, me: viewerId, now: Date.now(), visible: visible(), online: navigator.onLine, settled });
    run.current({ state: p.current, delay: !settled && visible() ? FAST_MS : null });

    const onVis = () => p.current && run.current(onVisibility(p.current, visible()));
    const onFocus = () => p.current && run.current(onWake(p.current));
    const onOnline = () => p.current && run.current(onWake(p.current, true));
    const onOff = () => p.current && run.current(onOffline(p.current));
    const onUser = () => p.current && run.current(onInteraction(p.current, Date.now()));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOff);
    window.addEventListener("pointerdown", onUser, { passive: true });
    window.addEventListener("keydown", onUser, { passive: true });
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("pointerdown", onUser);
      window.removeEventListener("keydown", onUser);
    };
    // A versão inicial e o perfil só contam na montagem; as versões seguintes entram por onSeen (abaixo).
  }, [sessionId, router]);

  // Dados novos chegaram por outra via (ex.: a resposta de uma ação minha): essa versão já está no ecrã.
  useEffect(() => {
    if (p.current) p.current = onSeen(p.current, version);
  }, [version]);

  // A página já mostra a sessão fechada (ex.: dados vindos de outra via): para de perguntar.
  useEffect(() => {
    if (settled && p.current && p.current.status !== "settled") run.current({ state: { ...p.current, status: "settled" }, delay: null });
  }, [settled]);

  // Um refresh de cada vez: quando termina, faz o próximo se entretanto chegou outra versão.
  useEffect(() => {
    if (wasRefreshing.current && !refreshing && p.current) run.current(onRefreshDone(p.current));
    wasRefreshing.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const label = LABEL[status];
  return (
    <LiveActorContext.Provider value={actor}>
      {label && (
        <p className="mb-2 flex items-center gap-1.5 text-[12px] text-ivory/70">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${status === "live" ? "bg-win" : status === "settled" ? "bg-gold-soft" : "bg-loss-soft"}`}
          />
          {label}
        </p>
      )}
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 flex justify-center px-4"
      >
        <p
          className={`rounded-full bg-ink px-4 py-2 text-sm font-medium text-ivory shadow-lg transition-[opacity,transform] duration-200 ${
            toast ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {toast?.text ?? ""}
        </p>
      </div>
    </LiveActorContext.Provider>
  );
}
