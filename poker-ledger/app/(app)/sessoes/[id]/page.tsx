import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewerPage } from "@/lib/identity";
import { isAdmin } from "@/lib/admin";
import { getActivePlayers, getSessionDetail } from "@/lib/queries";
import { formatDay, toDateInput } from "@/lib/format";
import { Sheet } from "@/components/ui/Sheet";
import { SessionLive } from "@/components/session/SessionLive";
import { LiveSession } from "@/components/session/LiveSession";
import { AddPlayersForm } from "@/components/session/AddPlayersForm";
import { EditSessionForm } from "@/components/session/EditSessionForm";
import { DeleteSessionForm } from "@/components/session/DeleteSessionForm";

export const metadata: Metadata = { title: "Sessão" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewerPage();
  const { id } = await params;
  const [s, active, admin] = await Promise.all([getSessionDetail(id), getActivePlayers(), isAdmin()]);
  if (!s) notFound();
  const editable = !s.settlement;
  const inSession = new Set(s.players.map((p) => p.playerId));
  const names = Object.fromEntries([...active.map((p) => [p.id, p.name]), ...s.players.map((p) => [p.playerId, p.player.name])]);

  return (
    <>
      <Link href="/sessoes" className="inline-flex min-h-11 items-center text-sm font-medium text-gold-soft">
        ← Sessões
      </Link>
      <header className="mb-4">
        <h1 className="font-display text-[24px] font-semibold capitalize">{formatDay(s.date)}</h1>
        <p className="text-[13px] text-ivory/75">
          Criada por {s.createdBy.name}
          {s.notes ? ` · ${s.notes}` : ""}
        </p>
      </header>

      {s.settlement ? (
        <p className="mb-4 rounded-2xl bg-ink/40 px-4 py-3 text-sm">
          🔒{"︎"} Fechada em{" "}
          <Link href={`/contas/${s.settlement.id}`} className="font-semibold text-gold-soft underline underline-offset-4">
            {s.settlement.label}
          </Link>
          . Já não pode ser editada.
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          <Sheet label="Escolher jogadores" title="Escolher jogadores" size="sm">
            <AddPlayersForm sessionId={s.id} players={active.filter((p) => !inSession.has(p.id))} />
          </Sheet>
          <Sheet label="Editar sessão" title="Editar sessão" size="sm">
            <EditSessionForm sessionId={s.id} date={toDateInput(s.date)} defaultBuyIn={s.defaultBuyIn} notes={s.notes ?? ""} />
          </Sheet>
          {admin && (
            <Sheet label="Apagar sessão" title="Apagar sessão" variant="danger" size="sm">
              <DeleteSessionForm sessionId={s.id} summary={`a sessão de ${formatDay(s.date)}`} />
            </Sheet>
          )}
        </div>
      )}

      <LiveSession sessionId={s.id} version={s.version} viewerId={viewer.id} names={names} settled={!editable}>
        <SessionLive
          sessionId={s.id}
          isAdmin={admin}
          reconciliation={
            s.reconciledAt && s.adjustmentMethod && s.discrepancy !== null
              ? {
                  method: s.adjustmentMethod,
                  discrepancy: s.discrepancy,
                  byName: s.reconciledBy?.name ?? null,
                  playerName: s.adjustmentPlayer?.name ?? null,
                }
              : null
          }
          editable={editable}
          defaultBuyIn={s.defaultBuyIn}
          players={s.players.map((p) => ({
            id: p.id,
            playerId: p.playerId,
            name: p.player.name,
            avatarColor: p.player.avatarColor,
            cashOut: p.cashOut,
            adjustment: p.adjustment,
            buyIns: p.buyIns,
          }))}
        />
      </LiveSession>
    </>
  );
}
