import { Chip, type ChipColor } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";

type Entry = { id: string; name: string; balance: number };

const SLOTS: { place: number; color: ChipColor; h: string }[] = [
  { place: 2, color: "silver", h: "h-14" },
  { place: 1, color: "gold", h: "h-20" },
  { place: 3, color: "bronze", h: "h-10" },
];

/** Pódio com fichas dourada, prata e bronze. */
export function Podium({ top }: { top: Entry[] }) {
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Pódio">
      {SLOTS.map(({ place, color, h }) => {
        const e = top[place - 1];
        return (
          <li key={place} className={`flex flex-col items-center gap-1.5 ${place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"}`}>
            {e ? (
              <>
                <Chip name={e.name} color={color} size={place === 1 ? "lg" : "md"} />
                <span className="w-full truncate text-center text-[15px] font-semibold">{e.name}</span>
                <Money cents={e.balance} signed size="sm" />
              </>
            ) : (
              <span className="text-[13px] text-ivory/60">—</span>
            )}
            <span
              className={`glass mt-1 grid w-full place-items-center rounded-t-2xl rounded-b-md font-display text-lg font-bold text-gold-soft ${h}`}
            >
              <span className="sr-only">Lugar </span>
              {place}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
