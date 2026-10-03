import { NavLinks } from "./NavLinks";

/** Navegação inferior: pílula flutuante, opaca, respeita a safe area. */
export function Nav() {
  return (
    <nav
      aria-label="Principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="glass pointer-events-auto mx-auto max-w-md rounded-full p-1.5">
        <NavLinks />
      </div>
    </nav>
  );
}
