import Link from "next/link";
import { requireViewerPage } from "@/lib/identity";
import { getOpenState, getSettlements } from "@/lib/queries";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { Podium } from "@/components/Podium";
import { SessionItem } from "@/components/SessionItem";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/format";

export default async function Home() {
  const viewer = await requireViewerPage();
  const [open, settlements] = await Promise.all([getOpenState(), getSettlements(5)]);
  const mine = open.ranking.find((r) => r.id === viewer.id)?.balance ?? 0;
  const counted = open.sessions.length - open.invalid.length;
  const withResults = open.ranking.filter((r) => r.balance !== 0);

  return (
    <>
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ivory/75">Olá,</p>
          <h1 className="truncate font-display text-[24px] font-semibold">{viewer.name}</h1>
        </div>
        <Link href="/eu" aria-label={`${viewer.name}: o meu perfil`}>
          <Chip name={viewer.name} color={viewer.avatarColor} />
        </Link>
      </header>

      <Card className="relative overflow-hidden px-5 py-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-14 font-display text-[170px] leading-none opacity-[0.06]">
          ♠{"︎"}
        </span>
        <p className="text-sm text-ivory/80">O meu saldo em aberto</p>
        <p className="mt-2">
          <Money cents={mine} signed size="xl" />
        </p>
        <p className="mt-3 text-[13px] text-ivory/75">
          {counted} {counted === 1 ? "sessão conta" : "sessões contam"} para o próximo fecho
          {open.invalid.length > 0 && ` · ${open.invalid.length} por acertar`}
        </p>
      </Card>

      <SectionTitle>Classificação do ciclo</SectionTitle>
      {withResults.length === 0 ? (
        <Card>
          <EmptyState>Ainda não há resultados neste ciclo. Baralha e dá cartas!</EmptyState>
        </Card>
      ) : (
        <Card>
          <Podium top={open.ranking.slice(0, 3)} />
          {open.ranking.length > 3 && (
            <ul className="mt-4 divide-y divide-white/10">
              {open.ranking.slice(3).map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-right text-[13px] text-ivory/70">{i + 4}</span>
                  <Chip name={p.name} color={p.avatarColor} size="sm" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <Money cents={p.balance} signed size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <SectionTitle href="/sessoes" linkText="Ver todas">
        Sessões em aberto
      </SectionTitle>
      {open.sessions.length === 0 ? (
        <Card>
          <EmptyState>Nenhuma sessão em aberto. A próxima noite começa em Sessões.</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {open.sessions.map((s) => (
            <SessionItem
              key={s.id}
              s={{ id: s.id, date: s.date, players: s.playerCount, pot: s.check.totalIn, status: s.check.valid ? "ready" : "pending" }}
            />
          ))}
        </ul>
      )}

      <SectionTitle href="/contas" linkText="Contas">
        Histórico de fechos
      </SectionTitle>
      {settlements.length === 0 ? (
        <Card>
          <EmptyState>Ainda não se fecharam contas.</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {settlements.map((st) => (
            <li key={st.id}>
              <Link href={`/contas/${st.id}`} className="glass flex items-center justify-between gap-3 rounded-[24px] px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{st.label}</span>
                  <span className="block text-[13px] text-ivory/75">{formatDateTime(st.closedAt)}</span>
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
