"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const items = [
  { href: "/", label: "Início", icon: <path {...P} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { href: "/sessoes", label: "Sessões", icon: <><rect {...P} x="3" y="5" width="12" height="16" rx="2" /><path {...P} d="M18 4.5l3 1-4 14" /></> },
  { href: "/contas", label: "Contas", icon: <><circle {...P} cx="12" cy="12" r="8.5" /><circle {...P} cx="12" cy="12" r="4" strokeDasharray="2.5 2" /></> },
  { href: "/eu", label: "Eu", icon: <><circle {...P} cx="12" cy="8" r="4" /><path {...P} d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></> },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <ul className="grid grid-cols-4">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[13px] font-medium ${
                active ? "bg-gold-soft text-ink" : "text-ivory/80"
              }`}
            >
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
                {it.icon}
              </svg>
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
