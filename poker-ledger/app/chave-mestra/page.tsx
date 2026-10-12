import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MasterResetForm } from "@/components/profile/MasterResetForm";

export const metadata: Metadata = { title: "Chave mestra", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Página sem links na app: quem tem a chave mestra (ADMIN_PIN) repõe o PIN de qualquer pessoa. */
export default function MasterKeyPage() {
  return (
    <main className="page-in mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+40px)] pb-16">
      <h1 className="font-display text-[30px] leading-tight font-bold">Chave mestra</h1>
      <p className="mt-2 mb-6 text-ivory/80">
        Para repor o PIN de quem se esqueceu. Cada tentativa errada conta para o bloqueio do perfil dessa pessoa.
      </p>
      <Card>
        <MasterResetForm />
      </Card>
      <p className="mt-6 text-center text-sm">
        <Link href="/quem-es" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
          Voltar a Entrar
        </Link>
      </p>
    </main>
  );
}
