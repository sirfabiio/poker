"use client";

import { useActionState } from "react";
import { changeMyPin } from "@/lib/actions/players";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { PIN_MAX, PIN_MIN } from "@/lib/pin-rules";

const FIELDS = [
  ["currentPin", "PIN atual", "current-password"],
  ["newPin", `PIN novo (${PIN_MIN} a ${PIN_MAX} algarismos)`, "new-password"],
  ["newPinConfirm", "Confirma o PIN novo", "new-password"],
] as const;

/** Trocar o meu PIN (os outros dispositivos voltam a pedir o PIN). */
export function ChangePinForm() {
  const [state, action, pending] = useActionState(changeMyPin, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-3">
      {FIELDS.map(([name, label, ac]) => (
        <label key={name} className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">{label}</span>
          <input
            name={name}
            type="password"
            inputMode="numeric"
            autoComplete={ac}
            required
            minLength={PIN_MIN}
            maxLength={PIN_MAX}
            pattern="[0-9]*"
            className="money h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3 tracking-[0.3em]"
          />
        </label>
      ))}
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-win" : "text-loss-soft"}`}>
          {state.ok ? "✓ PIN trocado. Os outros dispositivos vão pedir o PIN novo." : state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("secondary", "md", "w-full")}>
        {pending ? "A guardar…" : "Trocar PIN"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
