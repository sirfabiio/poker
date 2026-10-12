"use client";

import { useActionState } from "react";
import Link from "next/link";
import { masterResetPin } from "@/lib/actions/master";
import { PIN_MAX, PIN_MIN } from "@/lib/pin-rules";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

const field = "h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3";

/** Repor o PIN de alguém com a chave mestra (o servidor verifica tudo). */
export function MasterResetForm() {
  const [state, action, pending] = useActionState(masterResetPin, null);
  const online = useOnline();
  if (state?.ok) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-ivory/90">
          PIN de <strong>{state.name}</strong> reposto. As sessões abertas dessa pessoa terminaram; entra agora com o PIN novo.
        </p>
        <Link href="/quem-es" className={buttonClass("primary", "md", "w-full")}>
          Ir para Entrar
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Chave mestra</span>
        <input name="masterKey" type="password" inputMode="numeric" autoComplete="off" required className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome da pessoa</span>
        <input key={state?.lastName} name="name" defaultValue={state?.lastName} required minLength={2} maxLength={30} autoComplete="off" className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">PIN novo</span>
        <input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" minLength={PIN_MIN} maxLength={PIN_MAX} autoComplete="new-password" required className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Confirma o PIN novo</span>
        <input name="pinConfirm" type="password" inputMode="numeric" pattern="[0-9]*" minLength={PIN_MIN} maxLength={PIN_MAX} autoComplete="new-password" required className={field} />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A repor…" : "Repor PIN"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
