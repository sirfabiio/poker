"use client";

import { useActionState } from "react";
import { updateMyProfile } from "@/lib/actions/players";
import { AVATAR_COLORS, AVATAR_COLOR_LABELS } from "@/lib/colors";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

export function ProfileForm({ name, avatarColor, ibanOrMbway }: { name: string; avatarColor: string; ibanOrMbway: string }) {
  const [state, action, pending] = useActionState(updateMyProfile, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome</span>
        <input name="name" defaultValue={name} required minLength={2} maxLength={30} className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3" />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm text-ivory/80">Cor da ficha</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <label key={c} className="relative">
              <input type="radio" name="avatarColor" value={c} defaultChecked={c === avatarColor} className="peer sr-only" />
              <span className={`chip chip-${c} size-11 ring-offset-2 ring-offset-felt-700 peer-checked:ring-2 peer-checked:ring-gold-soft peer-focus-visible:ring-2 peer-focus-visible:ring-ivory`} />
              <span className="sr-only">{AVATAR_COLOR_LABELS[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">IBAN ou MB WAY (para te pagarem)</span>
        <input
          name="ibanOrMbway"
          defaultValue={ibanOrMbway}
          maxLength={64}
          placeholder="PT50… ou 9xx xxx xxx"
          className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3 font-mono"
        />
      </label>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-win" : "text-loss-soft"}`}>
          {state.ok ? "✓ Perfil guardado." : state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A guardar…" : "Guardar perfil"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
