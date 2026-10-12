import type { Metadata } from "next";
import Link from "next/link";
import { requireGroupPage } from "@/lib/group";
import { getGroupMembers } from "@/lib/queries";
import { describeObligations, groupObligations } from "@/lib/obligations";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/SectionTitle";
import { AddMemberForm } from "@/components/profile/AddMemberForm";
import { PlayerAdminRow } from "@/components/profile/PlayerAdminRow";
import { RenameGroupForm } from "@/components/group/RenameGroupForm";

export const metadata: Metadata = { title: "Grupo" };

/** Definições do grupo atual. As ações de admin só aparecem a admins (e o servidor volta a verificar). */
export default async function GroupSettings() {
  const { viewer, groupId, groupName, role } = await requireGroupPage();
  const admin = role === "ADMIN";
  const [members, obligations] = admin ? await Promise.all([getGroupMembers(groupId), groupObligations(groupId)]) : [[], new Map()];

  return (
    <>
      <header className="mb-5">
        <p className="text-sm text-ivory/75">Definições do grupo</p>
        <h1 className="truncate font-display text-[24px] font-semibold">{groupName}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="rounded-full bg-ink/40 px-2.5 py-0.5 text-[13px] font-semibold text-ivory/85">{admin ? "Admin" : "Membro"}</span>
          <Link href="/grupos" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            Mudar de grupo
          </Link>
        </p>
      </header>

      {admin && (
        <>
          <SectionTitle>Nome do grupo</SectionTitle>
          <Card>
            <RenameGroupForm name={groupName} />
          </Card>

          <SectionTitle>Juntar membro</SectionTitle>
          <Card>
            <AddMemberForm />
          </Card>

          <SectionTitle>Membros</SectionTitle>
          <p className="mb-3 text-[13px] text-ivory/75">
            Remover tira a pessoa deste grupo, mas as sessões e contas antigas ficam iguais e podes voltá-la a juntar. Só dá para remover quem não
            deve nem tem dinheiro a receber no grupo. O nome e o PIN valem em todos os grupos da pessoa: só os podes mudar se ela estiver apenas em
            grupos onde és admin; senão, muda-os ela no ecrã “Eu”.
          </p>
          <Card className="py-1">
            <ul className="divide-y divide-white/10">
              {members.map((p) => (
                <PlayerAdminRow
                  key={p.id}
                  p={p}
                  isMe={p.id === viewer.id}
                  groupName={groupName}
                  blockers={obligations.has(p.id) ? describeObligations(obligations.get(p.id)!, p.name) : []}
                />
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
