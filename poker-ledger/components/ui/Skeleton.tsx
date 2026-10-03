/** Bloco estático (sem shimmer: nada de efeitos contínuos). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-2xl bg-white/[0.07] ${className}`} />;
}

/** Esqueleto genérico de página: título + cartões. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="A carregar" className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full rounded-[24px]" />
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-[24px]" />
      ))}
    </div>
  );
}
