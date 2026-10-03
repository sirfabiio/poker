"use client";

import { useActionState } from "react";
import { adminLogin } from "@/lib/actions/players";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

export function AdminPinForm() {
  const [state, action, pending] = useActionState(adminLogin, null);
  const online = useOnline();
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">PIN de admin</span>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          minLength={6}
          className="money h-12 w-full rounded-xl border border-white/20 bg-ink/40 px-4 text-lg tracking-[0.3em]"
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-loss-soft">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A verificar…" : "Entrar como admin"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
