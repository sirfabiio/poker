export function SuitDivider({ className = "" }: { className?: string }) {
  return (
    <div role="separator" className={`my-6 flex items-center gap-3 text-ivory/45 ${className}`}>
      <span className="h-px flex-1 bg-white/15" />
      <span aria-hidden="true" className="text-sm tracking-[0.45em]">
        {"♠︎♥︎♦︎♣︎"}
      </span>
      <span className="h-px flex-1 bg-white/15" />
    </div>
  );
}
