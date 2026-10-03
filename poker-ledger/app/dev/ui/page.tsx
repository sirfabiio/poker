import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Nav } from "@/components/ui/Nav";
import { Chip } from "@/components/ui/Chip";
import { ChipStack } from "@/components/ui/ChipStack";
import { Money } from "@/components/ui/Money";
import { Ticket } from "@/components/ui/Ticket";
import { SuitDivider } from "@/components/ui/SuitDivider";
import { Skeleton, PageSkeleton } from "@/components/ui/Skeleton";
import { PotTable } from "@/components/session/PotTable";
import { Podium } from "@/components/Podium";
import { EmptyState } from "@/components/EmptyState";
import { SessionLive } from "@/components/session/SessionLive";
import { AVATAR_COLORS } from "@/lib/colors";

export const metadata = { title: "UI (dev)", robots: { index: false } };

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-[21px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Catálogo de componentes e estados — só existe em desenvolvimento. */
export default function DevUi() {
  if (process.env.NODE_ENV === "production") notFound();
  const ana = { name: "Ana", avatarColor: "blue" };
  const rui = { name: "Rui Santos", avatarColor: "red" };

  return (
    <main className="mx-auto max-w-xl px-4 pt-10 pb-40">
      <h1 className="mb-6 font-display text-[34px] font-bold">Componentes UI</h1>

      <Block title="Button">
        <div className="flex flex-wrap gap-2">
          <Button>Principal</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Perigo</Button>
          <Button disabled>Desativado</Button>
          <Button size="sm">Pequeno</Button>
          <Button size="lg">Grande</Button>
        </div>
      </Block>

      <Block title="Card">
        <Card>
          <p>Cartão glass-lite: gradiente sobre feltro, borda 1px, realce especular e uma só sombra.</p>
        </Card>
      </Block>

      <Block title="Chip (avatar)">
        <div className="flex flex-wrap items-center gap-3">
          {AVATAR_COLORS.map((c) => (
            <Chip key={c} name={`${c} x`} color={c} />
          ))}
          <Chip name="Prata" color="silver" />
          <Chip name="Bronze" color="bronze" />
          <Chip name="Pequeno" color="red" size="sm" />
          <Chip name="Grande" color="gold" size="lg" />
          <Chip name="Enorme" color="blue" size="xl" />
        </div>
      </Block>

      <Block title="ChipStack">
        <div className="flex items-end gap-6">
          <ChipStack count={1} />
          <ChipStack count={3} />
          <ChipStack count={8} />
          <ChipStack count={12} />
        </div>
      </Block>

      <Block title="Money">
        <div className="space-y-2">
          <p>
            <Money cents={2050} /> · <Money cents={-2050} /> · <Money cents={0} />
          </p>
          <p>
            <Money cents={1250} signed /> · <Money cents={-1250} signed /> · <Money cents={0} signed />
          </p>
          <p>
            <Money cents={4575} signed size="lg" /> · <Money cents={-4575} signed size="lg" />
          </p>
          <Money cents={12345} signed size="xl" />
          <br />
          <Money cents={-12345} signed size="xl" />
        </div>
      </Block>

      <Block title="Ticket">
        <div className="space-y-3">
          <Ticket from={rui} to={ana} amount={3550} paid={false}>
            <p className="text-sm">Por pagar, com ações.</p>
          </Ticket>
          <Ticket from={ana} to={rui} amount={1200} paid />
        </div>
      </Block>

      <Block title="SuitDivider">
        <SuitDivider />
      </Block>

      <Block title="Skeleton">
        <Skeleton className="mb-3 h-6 w-40" />
        <PageSkeleton cards={1} />
      </Block>

      <Block title="Sheet">
        <Sheet label="Abrir folha" title="Folha de exemplo">
          <p className="text-ivory/85">Bottom sheet com scrim, pega visual e transição de transform.</p>
        </Sheet>
      </Block>

      <Block title="Mesa (PotTable)">
        <PotTable pot={16000} players={6} />
      </Block>

      <Block title="Pódio">
        <Card>
          <Podium
            top={[
              { id: "1", name: "Ana", balance: 5300 },
              { id: "2", name: "Rui", balance: 2100 },
              { id: "3", name: "Sofia", balance: 300 },
            ]}
          />
        </Card>
      </Block>

      <Block title="Estado vazio">
        <Card>
          <EmptyState>Nada por aqui ainda.</EmptyState>
        </Card>
      </Block>

      <Block title="Sessão (otimista; os IDs são falsos, por isso o servidor recusa e a UI reverte)">
        <SessionLive
          sessionId="demo"
          isAdmin={false}
          reconciliation={null}
          editable
          defaultBuyIn={2000}
          players={[
            { id: "x1", playerId: "p1", name: "Ana", avatarColor: "blue", cashOut: null, adjustment: 0, buyIns: [{ id: "b1", amount: 2000 }] },
            { id: "x2", playerId: "p2", name: "Rui", avatarColor: "red", cashOut: 3500, adjustment: 0, buyIns: [{ id: "b2", amount: 2000 }, { id: "b3", amount: 2000 }] },
          ]}
        />
      </Block>

      <Nav />
    </main>
  );
}
