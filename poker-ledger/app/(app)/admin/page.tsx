import type { Metadata } from "next";
import { requireGroupPage } from "@/lib/group";
import { getGroupMembers } from "@/lib/queries";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { AddMemberForm } from "@/components/profile/AddMemberForm";
import { PlayerAdminRow } from "@/components/profile/PlayerAdminRow";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { viewer, groupId, groupName, role } = await requireGroupPage();

  if (role !== "ADMIN") {
    return (
      <>
        <h1 className="mb-2 font-display text-[24px] font-semibold">Admin</h1>
        <Card>
          <EmptyState>Só o admin do grupo “{groupName}” pode gerir membros e fechar contas.</EmptyState>
        </Card>
      </>
    );
  }

  const members = await getGroupMembers(groupId);
  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[24px] font-semibold">Admin</h1>
        <p className="text-sm text-ivory/75">Grupo “{groupName}”. As ações de admin só valem dentro deste grupo.</p>
      </header>
      <Button href="/contas" className="w-full">
        Ir para Contas e fechar o ciclo
      </Button>

      <SectionTitle>Juntar membro</SectionTitle>
      <Card>
        <AddMemberForm />
      </Card>

      <SectionTitle>Membros</SectionTitle>
      <p className="mb-3 text-[13px] text-ivory/75">
        Ninguém é apagado: desativar esconde a pessoa das listas deste grupo e mantém o histórico. Nome e PIN só se mudam aqui se a pessoa não estiver noutro grupo onde não és admin.
      </p>
      <Card className="py-1">
        <ul className="divide-y divide-white/10">
          {members.map((p) => (
            <PlayerAdminRow key={p.id} p={p} isMe={p.id === viewer.id} />
          ))}
        </ul>
      </Card>
    </>
  );
}
