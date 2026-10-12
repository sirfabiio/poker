"use client";

import { useActionState, useEffect, useMemo, useState, startTransition } from "react";
import { addMember } from "@/lib/actions/players";
import { buttonClass } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

export type Candidate = { id: string; name: string; avatarColor: string; removedHere: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-PT").trim();

/**
 * Admin junta alguém ao grupo: escreve o nome (pessoa já registada ou perfil novo, que define o PIN no 1.º acesso)
 * ou procura na lista de pessoas da app. O servidor volta a verificar tudo.
 */
export function AddMemberForm({ candidates }: { candidates: Candidate[] }) {
  const [state, action, pending] = useActionState(addMember, null);
  const [query, setQuery] = useState("");
  const [showList, setShowList] = useState(false);
  const online = useOnline();
  // Depois de juntar alguém, limpa o nome (a lista vem atualizada do servidor).
  useEffect(() => {
    if (state?.ok) setQuery("");
  }, [state]);
  const matches = useMemo(() => {
    const q = fold(query);
    return q ? candidates.filter((c) => fold(c.name).includes(q)) : candidates;
  }, [candidates, query]);
  const join = (name: string) => {
    const fd = new FormData();
    fd.set("name", name);
    startTransition(() => action(fd));
  };
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ivory/80">Nome da pessoa</span>
          <input
            name="name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            minLength={2}
            maxLength={30}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-white/20 bg-ink/40 px-3"
          />
        </label>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-win" : "text-loss-soft"}`}>
            {state.ok
              ? state.created
                ? "✓ Perfil criado e junto ao grupo. No primeiro acesso, a pessoa escolhe o PIN."
                : "✓ Junto ao grupo."
              : state.error}
          </p>
        )}
        <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md", "w-full")}>
          {pending ? "A juntar…" : "Juntar ao grupo"}
        </button>
        {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
      </form>

      {candidates.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showList}
            aria-controls="join-list"
            onClick={() => setShowList((v) => !v)}
            className={buttonClass("secondary", "md", "w-full")}
          >
            {showList ? "Esconder a lista" : `Procurar na lista de pessoas (${candidates.length})`}
          </button>
          {showList && (
            <div id="join-list" className="mt-3">
              <p className="mb-2 text-[13px] text-ivory/75">
                {query.trim() ? `${matches.length} com “${query.trim()}” (filtra pelo nome escrito acima).` : "Escreve acima para filtrar."}
              </p>
              {matches.length === 0 ? (
                <p className="text-sm text-ivory/80">Ninguém com esse nome. Carrega em “Juntar ao grupo” para criar um perfil novo.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-white/10 overflow-y-auto overscroll-contain rounded-2xl bg-ink/30 px-3">
                  {matches.map((c) => (
                    <li key={c.id} className="flex min-h-14 items-center gap-3 py-2">
                      <Chip name={c.name} color={c.avatarColor} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.name}</span>
                        {c.removedHere && <span className="block text-[13px] text-ivory/75">Foi removido deste grupo</span>}
                      </span>
                      <button
                        type="button"
                        disabled={pending || !online}
                        onClick={() => join(c.name)}
                        aria-label={`Juntar ${c.name} ao grupo`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Juntar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
