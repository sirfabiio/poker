"use client";

import { useState, useTransition } from "react";
import { resetMemberPin } from "@/lib/actions/players";
import { buttonClass } from "@/components/ui/Button";
import { useOnline } from "@/lib/use-online";
import { PIN_MAX, PIN_MIN } from "@/lib/pin-rules";

/** O admin do grupo define um PIN novo para um membro que se esqueceu do seu. */
export function AdminPinForm({ playerId, name, onDone }: { playerId: string; name: string; onDone: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const pin = String(new FormData(e.currentTarget).get("pin") ?? "");
        start(async () => {
          const r = await resetMemberPin(playerId, pin);
          setMsg(r.ok ? { ok: true, text: `PIN novo de ${name} guardado. Diz-lhe qual é.` } : { ok: false, text: r.error });
          if (r.ok) setTimeout(onDone, 2500);
        });
      }}
    >
      <label className="block">
        <span className="mb-1 block text-sm text-ivory/80">PIN novo para {name}</span>
        <span className="flex gap-2">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            required
            minLength={PIN_MIN}
            maxLength={PIN_MAX}
            pattern="[0-9]*"
            className="money h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-ink/40 px-3 tracking-[0.3em]"
          />
          <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md")}>
            Guardar
          </button>
        </span>
      </label>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-win" : "text-loss-soft"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
