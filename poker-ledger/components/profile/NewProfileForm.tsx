"use client";

import { useActionState } from "react";
import { signUp } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { PIN_MAX, PIN_MIN } from "@/lib/pin-rules";

const field = "h-12 w-full rounded-2xl border border-white/20 bg-ink/40 px-4 text-ivory";

/** "Sou novo aqui": nome + PIN (com confirmação), cria o perfil e entra. */
export function NewProfileForm() {
  const [state, action, pending] = useActionState(signUp, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">O teu nome</span>
        <input name="name" required minLength={2} maxLength={30} autoComplete="username" className={field} />
      </label>
      {(["pin", "pinConfirm"] as const).map((n) => (
        <label key={n} className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">
            {n === "pin" ? `Escolhe um PIN (${PIN_MIN} a ${PIN_MAX} algarismos)` : "Confirma o PIN"}
          </span>
          <input
            name={n}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            required
            minLength={PIN_MIN}
            maxLength={PIN_MAX}
            pattern="[0-9]*"
            className={`${field} money tracking-[0.3em]`}
          />
        </label>
      ))}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A criar…" : "Criar perfil e entrar"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
