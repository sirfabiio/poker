import type { Metadata } from "next";
import Link from "next/link";
import { requireViewerPage } from "@/lib/identity";
import { getActivityPage } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Atividade" };

export default async function Activity({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireViewerPage();
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.p) || 1));
  const { rows, hasNext } = await getActivityPage(page);

  return (
    <>
      <Link href="/eu" className="inline-flex min-h-11 items-center text-sm font-medium text-gold-soft">
        ← Eu
      </Link>
      <h1 className="mb-1 font-display text-[24px] font-semibold">Atividade</h1>
      <p className="mb-4 text-sm text-ivory/75">Quem alterou o quê. Página {page}.</p>
      {rows.length === 0 ? (
        <Card>
          <EmptyState>Sem atividade nesta página.</EmptyState>
        </Card>
      ) : (
        <Card flush className="px-4 py-1">
          <ul className="divide-y divide-white/10">
            {rows.map((r) => (
              <li key={r.id} className="cv-auto flex items-start gap-3 py-3">
                <Chip name={r.actor.name} color={r.actor.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">{r.summary}</p>
                  <p className="text-[13px] text-ivory/75">{formatDateTime(r.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <nav aria-label="Páginas" className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={`/atividade?p=${page - 1}`} className="glass inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold">
            ← Mais recentes
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={`/atividade?p=${page + 1}`} className="glass inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold">
            Mais antigas →
          </Link>
        )}
      </nav>
    </>
  );
}
