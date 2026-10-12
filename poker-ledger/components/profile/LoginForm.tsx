"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";
import { PIN_MAX, PIN_MIN } from "@/lib/pin-rules";

const field = "h-12 w-full rounded-2xl border border-white/20 bg-ink/40 px-4 text-ivory";

/**
 * Entrar com nome + PIN. Quem ainda não tem PIN (primeiro acesso) pode escrever só o nome e carregar em Entrar:
 * aparece logo "Escolhe o teu PIN" com a confirmação.
 */
export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const online = useOnline();
  const confirm = state?.needsConfirm === true;
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">Nome</span>
        <input name="name" defaultValue={state?.name ?? ""} key={state?.name ?? ""} required minLength={2} maxLength={30} autoComplete="username" className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">{confirm ? "Escolhe o teu PIN" : "PIN"}</span>
        <input
          key={confirm ? "new" : "current"}
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete={confirm ? "new-password" : "current-password"}
          autoFocus={confirm}
          required={confirm}
          minLength={PIN_MIN}
          maxLength={PIN_MAX}
          pattern="[0-9]*"
          className={`${field} money tracking-[0.3em]`}
        />
      </label>
      {confirm && (
        <label className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">Confirma o PIN</span>
          <input
            name="pinConfirm"
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
      )}
      {state && !state.ok && (
        <p role="alert" className={`text-sm ${confirm ? "text-gold-soft" : "text-loss-soft"}`}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "A entrar…" : confirm ? "Definir PIN e entrar" : "Entrar"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
