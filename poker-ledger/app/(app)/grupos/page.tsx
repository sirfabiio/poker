import type { Metadata } from "next";
import { requireViewerPage } from "@/lib/identity";
import { getGroupContext, myGroups } from "@/lib/group";
import { switchGroup } from "@/lib/actions/groups";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { CreateGroupForm } from "@/components/profile/CreateGroupForm";

export const metadata: Metadata = { title: "Grupos" };

export default async function Groups() {
  const viewer = await requireViewerPage();
  const [groups, ctx] = await Promise.all([myGroups(viewer.id), getGroupContext()]);

  return (
    <>
      <h1 className="mb-1 font-display text-[24px] font-semibold">Grupos</h1>
      <p className="mb-4 text-sm text-ivory/75">Cada grupo só vê os seus jogadores, sessões e contas.</p>

      {groups.length === 0 ? (
        <Card>
          <EmptyState>Ainda não estás em nenhum grupo. Cria um, ou pede ao admin do teu grupo para te juntar.</EmptyState>
        </Card>
      ) : (
        <Card flush className="px-4 py-1">
          <ul className="divide-y divide-white/10">
            {groups.map((g) => {
              const current = g.group.id === ctx?.groupId;
              return (
                <li key={g.group.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{g.group.name}</span>
                    <span className="block text-[13px] text-ivory/75">{g.role === "ADMIN" ? "Admin" : "Membro"}</span>
                  </span>
                  {current ? (
                    <span className="rounded-full bg-gold-soft px-3 py-1 text-[13px] font-semibold text-ink">Atual</span>
                  ) : (
                    <form action={switchGroup.bind(null, g.group.id)}>
                      <button type="submit" className="glass min-h-9 rounded-full px-3.5 text-sm font-semibold">
                        Mudar para este
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <SectionTitle>Criar grupo</SectionTitle>
      <Card>
        <CreateGroupForm />
      </Card>
    </>
  );
}
