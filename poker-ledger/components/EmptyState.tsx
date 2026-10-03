/** Estado vazio: frase curta e SVG simples (< 1 KB). */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center text-ivory/75">
      <svg aria-hidden="true" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(240,217,138,.5)" strokeWidth="2" strokeDasharray="6 5" />
        <path d="M28 14c6 7 13 10 13 17a6.5 6.5 0 0 1-11 4.6L32 42h-8l2-6.4A6.5 6.5 0 0 1 15 31c0-7 7-10 13-17z" fill="rgba(240,217,138,.75)" />
      </svg>
      <p className="max-w-[26ch]">{children}</p>
    </div>
  );
}
