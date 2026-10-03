import { Money } from "@/components/ui/Money";

/** "Mesa" oval em CSS com o total do pote ao centro. */
export function PotTable({ pot, players }: { pot: number; players: number }) {
  return (
    <div className="relative mx-auto grid aspect-[2.1/1] w-full max-w-[360px] place-items-center overflow-hidden rounded-[50%] border-[7px] border-ink bg-felt-500 outline-1 -outline-offset-[14px] outline-gold-soft/40">
      <div className="relative text-center">
        <p className="text-[13px] font-semibold tracking-[0.2em] text-ivory/90 uppercase">Pote</p>
        <Money cents={pot} size="xl" className="text-gold-soft" />
        <p className="mt-1 text-[13px] text-ivory/90">
          {players} {players === 1 ? "jogador" : "jogadores"}
        </p>
      </div>
    </div>
  );
}
