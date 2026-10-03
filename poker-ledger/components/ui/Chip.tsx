import { initials } from "@/lib/format";

export type ChipColor = "red" | "blue" | "gold" | "green" | "ink" | "ivory" | "silver" | "bronze";

const sizes = {
  sm: "size-8 text-[11px]",
  md: "size-11 text-sm",
  lg: "size-16 text-lg",
  xl: "size-20 text-2xl",
} as const;

/** Avatar em forma de ficha de poker: círculo colorido, anel tracejado e iniciais. */
export function Chip({
  name,
  color,
  size = "md",
  className = "",
}: {
  name: string;
  color: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`chip chip-${color} ${sizes[size]} ${className}`}>
      {initials(name)}
    </span>
  );
}
