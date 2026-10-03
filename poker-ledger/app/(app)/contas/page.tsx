import type { Metadata } from "next";
import Link from "next/link";
import { requireViewerPage } from "@/lib/identity";
import { isAdmin } from "@/lib/admin";
import { getOpenState, getSettlements } from "@/lib/queries";
import { formatCents } from "@/lib/money";
import { formatDateTime, formatDay, monthLabel } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Money } from "@/components/ui/Money";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { CloseAccountsForm } from "@/components/settle/CloseAccountsForm";

export const metadata: Metadata = { title: "Contas" };

export default async function Accounts() {
  await requireViewerPage();
  const [open, settlements, admin] = await Promise.all([getOpenState(), getSettlements(), isAdmin()]);
  const valid = open.sessions.length - open.invalid.length;
  const blocked = open.invalid.length > 0;
  const name = (id: string) => open.players.get(id)?.name ?? "?";

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[24px] font-semibold">Contas</h1>
        <p className="text-sm text-ivory/75">Os resultados acumulam até o admin fechar o ciclo.</p>
      </header>

      <Card>
        <h2 className="font-display text-[21px] font-semibold">Próximo fecho</h2>
        {open.sessions.length === 0 ? (
          <EmptyState>Não há sessões em aberto. Nada para fechar.</EmptyState>
        ) : (
          <>
            <p className="mt-1 text-sm text-ivory/80">
              {open.sessions.length} {open.sessions.length === 1 ? "sessão" : "sessões"} em aberto · {valid} pronta{valid === 1 ? "" : "s"}
            </p>

            {blocked && (
              <div role="alert" className="mt-3 rounded-2xl bg-loss/10 p-3 text-sm">
                <p className="font-semibold text-loss-soft">! O fecho está bloqueado. Acerta estas sessões primeiro:</p>
                <ul className="mt-2 space-y-1">
                  {open.invalid.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sessoes/${s.id}`} className="underline underline-offset-4">
                        <span className="capitalize">{formatDay(s.date)}</span>
                      </Link>
                      {" — "}
                      {s.check.missingCashOuts > 0
                        ? `faltam ${s.check.missingCashOuts} cash-out${s.check.missingCashOuts === 1 ? "" : "s"}`
                        : `${s.check.diff > 0 ? "sobram" : "faltam"} ${formatCents(s.check.diff)} — diferença de contagem por ajustar`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!blocked && open.preview.length > 0 && (
              <>
                <p className="mt-4 text-[13px] font-semibold tracking-wide text-ivory/75 uppercase">Pré-visualização</p>
                <ul className="mt-2 divide-y divide-white/10">
                  {open.preview.map((t) => (
                    <li key={`${t.fromPlayerId}-${t.toPlayerId}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {name(t.fromPlayerId)} → {name(t.toPlayerId)}
                      </span>
                      <Money cents={t.amount} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-4">
              {admin ? (
                <Sheet label="Fechar contas" title="Fechar contas" variant="primary" disabled={blocked} triggerClassName="w-full">
                  <CloseAccountsForm defaultLabel={monthLabel(new Date())} sessions={open.sessions.length} transfers={open.preview.length} />
                </Sheet>
              ) : (
                <Button href="/admin" variant="secondary" className="w-full">
                  Fechar contas (precisa do PIN de admin)
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      <SectionTitle>Fechos anteriores</SectionTitle>
      {settlements.length === 0 ? (
        <Card>
          <EmptyState>Ainda não se fecharam contas.</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {settlements.map((st) => (
            <li key={st.id} className="cv-auto">
              <Link href={`/contas/${st.id}`} className="glass flex items-center justify-between gap-3 rounded-[24px] px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{st.label}</span>
                  <span className="block text-[13px] text-ivory/75">
                    {formatDateTime(st.closedAt)} · {st._count.sessions} {st._count.sessions === 1 ? "sessão" : "sessões"}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ivory/80">
                  {st.transfers.length}/{st._count.transfers} pagas
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
