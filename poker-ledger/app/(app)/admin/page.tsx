import type { Metadata } from "next";
import { requireViewerPage } from "@/lib/identity";
import { isAdmin } from "@/lib/admin";
import { getAllPlayers } from "@/lib/queries";
import { adminLogout } from "@/lib/actions/players";
import { Card } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { SectionTitle } from "@/components/SectionTitle";
import { AdminPinForm } from "@/components/profile/AdminPinForm";
import { PlayerAdminRow } from "@/components/profile/PlayerAdminRow";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireViewerPage();
  const admin = await isAdmin();

  if (!admin) {
    return (
      <>
        <h1 className="mb-2 font-display text-[24px] font-semibold">Admin</h1>
        <p className="mb-5 text-sm text-ivory/80">Fechar contas e gerir jogadores precisa do PIN. A sessão de admin dura 12 horas.</p>
        <Card>
          <AdminPinForm />
        </Card>
      </>
    );
  }

  const players = await getAllPlayers();
  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] font-semibold">Admin</h1>
        <form action={adminLogout}>
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Sair do modo admin
          </button>
        </form>
      </header>
      <Button href="/contas" className="w-full">
        Ir para Contas e fechar o ciclo
      </Button>

      <SectionTitle>Jogadores</SectionTitle>
      <p className="mb-3 text-[13px] text-ivory/75">Jogadores nunca são apagados: desativar só os esconde das listas.</p>
      <Card className="py-1">
        <ul className="divide-y divide-white/10">
          {players.map((p) => (
            <PlayerAdminRow key={p.id} p={p} />
          ))}
        </ul>
      </Card>
    </>
  );
}
