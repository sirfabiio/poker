import Link from "next/link";

export function SectionTitle({ children, href, linkText }: { children: React.ReactNode; href?: string; linkText?: string }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[21px] font-semibold">{children}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-gold-soft">
          {linkText}
        </Link>
      )}
    </div>
  );
}
