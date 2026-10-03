import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewerPage } from "@/lib/identity";
import { isAdmin } from "@/lib/admin";
import { getSettlementDetail } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/EmptyState";
import { TicketLive } from "@/components/settle/TicketLive";

export const metadata: Metadata = { title: "Fecho" };

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewerPage();
  const { id } = await params;
  const [st, admin] = await Promise.all([getSettlementDetail(id), isAdmin()]);
  if (!st) notFound();
  const total = st.transfers.length;
  const paid = st.transfers.filter((t) => t.paid).length;

  return (
    <>
      <Link href="/contas" className="inline-flex min-h-11 items-center text-sm font-medium text-gold-soft">
        ← Contas
      </Link>
      <header className="mb-4">
        <h1 className="font-display text-[24px] font-semibold">{st.label}</h1>
        <p className="text-[13px] text-ivory/75">
          Fechado a {formatDateTime(st.closedAt)} · {st._count.sessions} {st._count.sessions === 1 ? "sessão" : "sessões"}
        </p>
      </header>

      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-ivory/80">Pagamentos</p>
          <p className="font-display text-[22px] font-semibold">
            {paid}/{total} <span className="text-sm font-normal text-ivory/80">pagas</span>
          </p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-ink/50"
          role="progressbar"
          aria-label="Transferências pagas"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={paid}
        >
          <div className="h-full origin-left rounded-full bg-gold" style={{ transform: `scaleX(${total ? paid / total : 1})` }} />
        </div>
      </Card>

      {total === 0 ? (
        <Card>
          <EmptyState>Ninguém deve nada a ninguém neste fecho. Raro, mas acontece!</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-3">
          {st.transfers.map((t) => (
            <TicketLive key={t.id} t={t} canMark={admin || t.from.id === viewer.id || t.to.id === viewer.id} />
          ))}
        </ul>
      )}
    </>
  );
}
