const MAX = 8;
const DISC = ["chip-gold", "chip-red", "chip-blue"];

/**
 * Pilha de fichas em CSS: uma por buy-in/rebuy, no máximo 8 e "+N".
 * Altura fixa para não causar CLS. `animateTop` faz a ficha do topo "cair" na pilha.
 */
export function ChipStack({ count, animateTop = false }: { count: number; animateTop?: boolean }) {
  const shown = Math.min(count, MAX);
  const extra = count - shown;
  return (
    <span
      role="img"
      aria-label={`${count} ${count === 1 ? "entrada" : "entradas"}`}
      className="inline-flex items-end gap-1.5"
    >
      <span className="relative block w-7" style={{ height: 10 + (MAX - 1) * 4 }}>
        {Array.from({ length: shown }, (_, i) => {
          const top = i === shown - 1;
          return (
            <span
              key={top ? `top-${count}` : i}
              className={`stack-disc ${i === 0 ? DISC[0] : DISC[1 + (i % 2)]} ${top && animateTop ? "chip-drop" : ""}`}
              style={{ bottom: i * 4 }}
            />
          );
        })}
      </span>
      {extra > 0 && <span className="text-[13px] font-semibold text-ivory/80">+{extra}</span>}
    </span>
  );
}
