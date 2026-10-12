import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/identity";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { SuitDivider } from "@/components/ui/SuitDivider";
import { LoginForm } from "@/components/profile/LoginForm";
import { NewProfileForm } from "@/components/profile/NewProfileForm";
import { MasterResetForm } from "@/components/profile/MasterResetForm";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function SignIn() {
  if (await getViewer()) redirect("/");
  return (
    <main className="page-in mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+40px)] pb-16">
      <h1 className="font-display text-[34px] leading-tight font-bold">Entrar</h1>
      <p className="mt-2 mb-6 text-ivory/80">
        Com o teu nome e PIN. Se é a primeira vez com um perfil que já existe, escolhe agora o teu PIN.
      </p>
      <Card>
        <LoginForm />
      </Card>
      <div className="mt-3 flex justify-center">
        <Sheet label="Esqueci-me do PIN" title="Esqueci-me do PIN" variant="ghost" size="sm">
          <p className="mb-4 text-sm text-ivory/85">
            Pede ao admin do teu grupo para te definir um PIN novo (em Grupo → Membros → Definir PIN). Se estiveres em vários grupos ou o admin não
            puder, quem tem a <strong>chave mestra</strong> repõe-no aqui.
          </p>
          <MasterResetForm />
        </Sheet>
      </div>
      <SuitDivider />
      <div className="flex justify-center">
        <Sheet label="Sou novo aqui" title="Sou novo aqui" variant="secondary" size="lg">
          <NewProfileForm />
        </Sheet>
      </div>
    </main>
  );
}
