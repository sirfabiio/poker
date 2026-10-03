import type { Metadata } from "next";
import { requireViewerPage } from "@/lib/identity";
import { getActivePlayers, getSessionRows } from "@/lib/queries";
import { todayInput } from "@/lib/format";
import { Sheet } from "@/components/ui/Sheet";
import { Card } from "@/components/ui/Card";
import { SessionItem } from "@/components/SessionItem";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { NewSessionForm } from "@/components/session/NewSessionForm";

export const metadata: Metadata = { title: "Sessões" };

export default async function Sessions() {
  await requireViewerPage();
  const [rows, players] = await Promise.all([getSessionRows(), getActivePlayers()]);
  const open = rows.filter((r) => !r.settlementId);
  const closed = rows.filter((r) => r.settlementId);

  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] font-semibold">Sessões</h1>
        <Sheet label="+ Nova sessão" title="Nova sessão" variant="primary">
          <NewSessionForm players={players} today={todayInput()} defaultBuyIn={2000} />
        </Sheet>
      </header>

      <SectionTitle>Em aberto</SectionTitle>
      {open.length === 0 ? (
        <Card>
          <EmptyState>Nenhuma sessão em aberto. Toca em “Nova sessão” quando a mesa abrir.</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {open.map((r) => (
            <SessionItem
              key={r.id}
              s={{ id: r.id, date: r.date, players: r.players, pot: r.pot, status: r.missing === 0 && r.out === r.pot ? "ready" : "pending" }}
            />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <SectionTitle>Fechadas</SectionTitle>
          <ul className="space-y-2.5">
            {closed.map((r) => (
              <SessionItem key={r.id} s={{ id: r.id, date: r.date, players: r.players, pot: r.pot, status: "closed", label: r.label }} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
