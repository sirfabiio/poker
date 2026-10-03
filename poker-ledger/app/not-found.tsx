import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+48px)]">
      <h1 className="font-display text-[28px] font-bold">Não encontrado</h1>
      <EmptyState>Esta carta não está no baralho.</EmptyState>
      <Link href="/" className="block text-center font-semibold text-gold-soft underline underline-offset-4">
        Voltar ao início
      </Link>
    </main>
  );
}
