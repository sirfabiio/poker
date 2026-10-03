"use client";

import { useState, useTransition } from "react";
import { chooseProfile, createOwnProfile } from "@/lib/actions/players";
import type { PlayerSummary } from "@/lib/players";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** "Sou novo aqui": pede só o nome, cria o perfil e entra com ele. */
export function NewProfileForm() {
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<PlayerSummary | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("name") ?? "");
        start(async () => {
          const r = await createOwnProfile(name);
          if (!r.ok) {
            setError(r.error);
            setExisting(r.existing ?? null);
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm text-ivory/80">O teu nome</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={30}
          autoComplete="given-name"
          className="h-12 w-full rounded-2xl border border-white/20 bg-ink/40 px-4 text-ivory"
        />
      </label>
      {error && (
        <div role="alert" className="rounded-2xl bg-ink/50 p-3 text-sm">
          <p className="text-loss-soft">{error}</p>
          {existing?.active && (
            <button
              type="button"
              className={buttonClass("secondary", "sm", "mt-2")}
              onClick={() => start(() => chooseProfile(existing.id).then(() => {}))}
            >
              Sou eu — entrar como {existing.name}
            </button>
          )}
          {existing && !existing.active && (
            <p className="mt-1 text-ivory/80">Esse perfil está desativado. Pede ao admin para o reativar.</p>
          )}
        </div>
      )}
      <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "A criar…" : "Criar perfil e entrar"}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </form>
  );
}
