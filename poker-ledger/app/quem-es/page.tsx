import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/identity";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { SuitDivider } from "@/components/ui/SuitDivider";
import { LoginForm } from "@/components/profile/LoginForm";
import { NewProfileForm } from "@/components/profile/NewProfileForm";

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
      <p className="mt-3 text-center text-[13px] text-ivory/75">
        Esqueceste-te do PIN? Pede ao admin do teu grupo, ou a quem tem a chave mestra, para o repor.
      </p>
      <SuitDivider />
      <div className="flex justify-center">
        <Sheet label="Sou novo aqui" title="Sou novo aqui" variant="secondary" size="lg">
          <NewProfileForm />
        </Sheet>
      </div>
    </main>
  );
}
