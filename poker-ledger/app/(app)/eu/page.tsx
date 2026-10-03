import type { Metadata } from "next";
import Link from "next/link";
import { requireViewerPage } from "@/lib/identity";
import { isAdmin } from "@/lib/admin";
import { getMyHistory, getOpenState } from "@/lib/queries";
import { switchProfile } from "@/lib/actions/players";
import { formatDay } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { Button, buttonClass } from "@/components/ui/Button";
import { SuitDivider } from "@/components/ui/SuitDivider";
import { SectionTitle } from "@/components/SectionTitle";
import { EmptyState } from "@/components/EmptyState";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Eu" };

export default async function Me() {
  const viewer = await requireViewerPage();
  const [open, history, admin] = await Promise.all([getOpenState(), getMyHistory(viewer.id), isAdmin()]);
  const balance = open.ranking.find((r) => r.id === viewer.id)?.balance ?? 0;

  return (
    <>
      <header className="mb-5 flex items-center gap-4">
        <Chip name={viewer.name} color={viewer.avatarColor} size="xl" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-[24px] font-semibold">{viewer.name}</h1>
          {admin && <p className="text-[13px] font-semibold text-gold-soft">Modo admin ativo</p>}
        </div>
      </header>

      <Card>
        <p className="text-sm text-ivory/80">Saldo em aberto</p>
        <Money cents={balance} signed size="lg" />
      </Card>

      <SectionTitle>Transferências pendentes</SectionTitle>
      {history.pending.length === 0 ? (
        <Card>
          <EmptyState>Nada pendente. Estás em dia!</EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {history.pending.map((t) => {
            const iPay = t.from.id === viewer.id;
            const other = iPay ? t.to : t.from;
            return (
              <li key={t.id}>
                <Link href={`/contas/${t.settlementId}`} className="ticket flex items-center gap-3 px-4 py-3">
                  <Chip name={other.name} color={other.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{iPay ? `Pagas a ${other.name}` : `Recebes de ${other.name}`}</span>
                    <span className="block text-[13px] text-ivory/75">{t.settlement.label}</span>
                  </span>
                  <Money cents={iPay ? -t.amount : t.amount} signed className="font-semibold" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle>O meu perfil</SectionTitle>
      <Card>
        <ProfileForm name={viewer.name} avatarColor={viewer.avatarColor} ibanOrMbway={viewer.ibanOrMbway ?? ""} />
      </Card>

      <SectionTitle>Histórico por sessão</SectionTitle>
      {history.sessions.length === 0 ? (
        <Card>
          <EmptyState>Ainda não jogaste nenhuma sessão.</EmptyState>
        </Card>
      ) : (
        <Card flush className="px-4 py-1">
          <ul className="divide-y divide-white/10">
            {history.sessions.map((s) => (
              <li key={s.id} className="cv-auto">
                <Link href={`/sessoes/${s.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate capitalize">{formatDay(s.date)}</span>
                    <span className="block text-[13px] text-ivory/75">{s.open ? "Em aberto" : "Fechada"}</span>
                    {s.adjustment !== 0 && (
                      <span className="mt-0.5 flex items-center gap-2 text-[13px] text-ivory/75">
                        Ajuste de contagem <Money cents={s.adjustment} signed size="sm" className="text-[13px]" />
                      </span>
                    )}
                  </span>
                  {s.complete ? <Money cents={s.net} signed /> : <span className="text-[13px] text-ivory/75">Em jogo</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SuitDivider />
      <div className="grid gap-2.5">
        <Button href="/atividade" variant="secondary">
          Histórico de atividade
        </Button>
        <Button href="/admin" variant="secondary">
          {admin ? "Admin: jogadores" : "Entrar como admin"}
        </Button>
        <form action={switchProfile}>
          <button type="submit" className={buttonClass("ghost", "md", "w-full")}>
            Trocar de perfil
          </button>
        </form>
      </div>
    </>
  );
}
