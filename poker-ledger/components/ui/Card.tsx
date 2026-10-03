import type { HTMLAttributes, ElementType } from "react";

type CardProps = HTMLAttributes<HTMLElement> & { as?: ElementType; flush?: boolean };

export function Card({ as: Tag = "section", className = "", flush = false, ...rest }: CardProps) {
  return <Tag className={`glass rounded-[24px] ${flush ? "" : "p-4"} ${className}`} {...rest} />;
}
