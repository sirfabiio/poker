"use client";

import { useState, useTransition } from "react";
import { removeMember } from "@/lib/actions/players";
import { useSheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import { useOnline, OFFLINE_HINT } from "@/lib/use-online";

/** Confirmação para remover um membro do grupo (só admin; o servidor volta a verificar as contas). */
export function RemoveMemberForm({
  member,
  groupName,
  blockers,
}: {
  member: { id: string; name: string; avatarColor: string };
  groupName: string;
  blockers: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  const { close } = useSheet();
  const blocked = blockers.length > 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-ink/40 px-4 py-3">
        <Chip name={member.name} color={member.avatarColor} size="sm" />
        <span className="min-w-0 truncate font-semibold">{member.name}</span>
      </div>
      {blocked ? (
        <div role="alert" className="rounded-2xl bg-loss/10 p-3 text-sm">
          <p className="font-semibold text-loss-soft">Ainda não dá para remover {member.name}. Falta saldar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ivory/90">
          Vais remover <strong>{member.name}</strong> do grupo “{groupName}”. Deixa de ver o grupo e os seus dados. As sessões e contas antigas não
          mudam, e podes voltar a juntar esta pessoa mais tarde.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss-soft">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !online || blocked}
        className={buttonClass("danger", "lg", "w-full")}
        onClick={() =>
          start(async () => {
            const r = await removeMember(member.id);
            if (r.ok) close();
            setError(r.ok ? null : r.error);
          })
        }
      >
        {pending ? "A remover…" : `Remover ${member.name}`}
      </button>
      {!online && <p className="text-sm text-ivory/75">{OFFLINE_HINT}</p>}
    </div>
  );
}
