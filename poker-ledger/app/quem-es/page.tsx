import type { Metadata } from "next";
import { getActivePlayers } from "@/lib/queries";
import { chooseProfileForm } from "@/lib/actions/players";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { SuitDivider } from "@/components/ui/SuitDivider";
import { EmptyState } from "@/components/EmptyState";
import { NewProfileForm } from "@/components/profile/NewProfileForm";

export const metadata: Metadata = { title: "Quem és tu?" };
export const dynamic = "force-dynamic";

export default async function WhoAreYou() {
  const players = await getActivePlayers();
  return (
    <main className="page-in mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+40px)] pb-16">
      <h1 className="font-display text-[34px] leading-tight font-bold">Quem és tu?</h1>
      <p className="mt-2 text-ivory/80">Escolhe o teu perfil. Fica guardado neste dispositivo.</p>

      {players.length === 0 ? (
        <EmptyState>Ainda não há ninguém à mesa. Sê o primeiro!</EmptyState>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {players.map((p) => (
            <li key={p.id}>
              <form action={chooseProfileForm.bind(null, p.id)}>
                <button
                  type="submit"
                  className="glass flex w-full flex-col items-center gap-2 rounded-[24px] p-4 transition-transform duration-150 active:scale-[0.97]"
                >
                  <Chip name={p.name} color={p.avatarColor} size="lg" />
                  <span className="w-full truncate font-semibold">{p.name}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <SuitDivider />
      <div className="flex justify-center">
        <Sheet label="Sou novo aqui" title="Sou novo aqui" variant="primary" size="lg">
          <NewProfileForm />
        </Sheet>
      </div>
    </main>
  );
}
