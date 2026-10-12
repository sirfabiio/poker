import type { Metadata } from "next";
import Link from "next/link";
import { requireGroupPage } from "@/lib/group";
import { getGroupMembers } from "@/lib/queries";
import { describeObligations, groupDeleteBlockers, groupObligations } from "@/lib/obligations";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/SectionTitle";
import { AddMemberForm } from "@/components/profile/AddMemberForm";
import { PlayerAdminRow } from "@/components/profile/PlayerAdminRow";
import { RenameGroupForm } from "@/components/group/RenameGroupForm";
import { Sheet } from "@/components/ui/Sheet";
import { LeaveGroupForm } from "@/components/group/LeaveGroupForm";
import { TransferAdminForm } from "@/components/group/TransferAdminForm";
import { DeleteGroupForm } from "@/components/group/DeleteGroupForm";

export const metadata: Metadata = { title: "Grupo" };

/** Definições do grupo atual. As ações de admin só aparecem a admins (e o servidor volta a verificar). */
export default async function GroupSettings() {
  const { viewer, groupId, groupName, role } = await requireGroupPage();
  const admin = role === "ADMIN";
  const [members, obligations, deleteBlockers] = await Promise.all([
    admin ? getGroupMembers(groupId) : [],
    groupObligations(groupId),
    admin ? groupDeleteBlockers(groupId) : [],
  ]);
  const mine = obligations.get(viewer.id);
  const others = members.filter((m) => m.active && m.id !== viewer.id);

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

          <SectionTitle>Passar admin</SectionTitle>
          <Card>
            <p className="mb-3 text-sm text-ivory/85">Passa o papel de admin a outro membro. Depois disso ficas membro normal e já podes sair do grupo.</p>
            {others.length === 0 ? (
              <p className="text-sm text-ivory/75">Ainda não há outros membros a quem passar o admin.</p>
            ) : (
              <Sheet label="Passar admin a outra pessoa" title="Passar admin" triggerClassName="w-full">
                <TransferAdminForm members={others.map(({ id, name, avatarColor }) => ({ id, name, avatarColor }))} />
              </Sheet>
            )}
          </Card>
        </>
      )}

      <SectionTitle>Sair do grupo</SectionTitle>
      <Card>
        {admin ? (
          <p className="text-sm text-ivory/85">És o admin: para saíres, passa primeiro o admin a outra pessoa (ou apaga o grupo).</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ivory/85">Só podes sair quando não deves nem tens dinheiro a receber neste grupo.</p>
            <Sheet label="Sair do grupo" title="Sair do grupo" variant="danger" triggerClassName="w-full">
              <LeaveGroupForm groupName={groupName} blockers={mine ? describeObligations(mine, "eu") : []} />
            </Sheet>
          </>
        )}
      </Card>

      {admin && (
        <>
          <SectionTitle>Apagar grupo</SectionTitle>
          <Card>
            <p className="mb-3 text-sm text-ivory/85">
              Só quando não há contas por pagar entre ninguém. O grupo desaparece para todos, mas os dados ficam guardados.
            </p>
            <Sheet label="Apagar grupo" title="Apagar grupo" variant="danger" triggerClassName="w-full">
              <DeleteGroupForm groupName={groupName} blockers={deleteBlockers} />
            </Sheet>
          </Card>
        </>
      )}
    </>
  );
}
