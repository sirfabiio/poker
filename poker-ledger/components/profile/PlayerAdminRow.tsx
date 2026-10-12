"use client";

import { useState, useTransition } from "react";
import { readmitMember, renamePlayer } from "@/lib/actions/players";
import { Chip } from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import { useOnline } from "@/lib/use-online";
import { Sheet } from "@/components/ui/Sheet";
import { RemoveMemberForm } from "@/components/group/RemoveMemberForm";
import { AdminPinForm } from "./AdminPinForm";

type Member = {
  id: string;
  name: string;
  avatarColor: string;
  active: boolean;
  role: "ADMIN" | "MEMBER";
  hasPin: boolean;
  otherGroups: number;
};

/** Linha de membro na gestão do grupo (só admin; o servidor volta a validar tudo). */
export function PlayerAdminRow({ p, isMe, groupName, blockers }: { p: Member; isMe: boolean; groupName: string; blockers: string[] }) {
  const [open, setOpen] = useState<"rename" | "pin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Chip name={p.name} color={p.avatarColor} size="sm" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${p.active ? "" : "text-ivory/60 line-through"}`}>{p.name}</span>
          <span className="block text-[13px] text-ivory/75">
            {!p.active ? "Removido do grupo" : p.role === "ADMIN" ? "Admin" : "Membro"}
            {!p.hasPin && " · ainda sem PIN"}
            {p.otherGroups > 0 && ` · também noutro${p.otherGroups > 1 ? "s" : ""} grupo${p.otherGroups > 1 ? "s" : ""}`}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-11">
        <button type="button" disabled={!online} onClick={() => setOpen((v) => (v === "rename" ? null : "rename"))} className={buttonClass("secondary", "sm")}>
          Renomear
        </button>
        <button type="button" disabled={!online} onClick={() => setOpen((v) => (v === "pin" ? null : "pin"))} className={buttonClass("secondary", "sm")}>
          Definir PIN
        </button>
        {!isMe && p.active && (
          <Sheet label="Remover" title="Remover do grupo" variant="danger" size="sm" disabled={!online}>
            <RemoveMemberForm member={p} groupName={groupName} blockers={blockers} />
          </Sheet>
        )}
        {!p.active && (
          <button
            type="button"
            disabled={pending || !online}
            onClick={() =>
              start(async () => {
                const r = await readmitMember(p.id);
                setError(r.ok ? null : r.error);
              })
            }
            className={buttonClass("secondary", "sm")}
          >
            Voltar a juntar
          </button>
        )}
      </div>
      {open === "rename" && (
        <form
          className="mt-2 flex gap-2 pl-11"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "");
            start(async () => {
              const r = await renamePlayer(p.id, name);
              if (r.ok) setOpen(null);
              setError(r.ok ? null : r.error);
            });
          }}
        >
          <label className="sr-only" htmlFor={`rn-${p.id}`}>
            Novo nome de {p.name}
          </label>
          <input id={`rn-${p.id}`} name="name" defaultValue={p.name} minLength={2} maxLength={30} required className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-ink/40 px-3" />
          <button type="submit" disabled={pending || !online} className={buttonClass("primary", "md")}>
            Guardar
          </button>
        </form>
      )}
      {open === "pin" && (
        <div className="pl-11">
          <AdminPinForm playerId={p.id} name={p.name} onDone={() => setOpen(null)} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 pl-11 text-sm text-loss-soft">
          {error}
        </p>
      )}
    </li>
  );
}
