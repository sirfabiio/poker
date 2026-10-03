import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+48px)]">
      <h1 className="font-display text-[28px] font-bold">Estás offline</h1>
      <EmptyState>Esta página ainda não foi aberta neste dispositivo. Volta a tentar quando tiveres rede.</EmptyState>
      <a href="/" className="block text-center font-semibold text-gold-soft underline underline-offset-4">
        Tentar outra vez
      </a>
    </main>
  );
}
