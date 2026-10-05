"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnline } from "@/lib/use-online";

/**
 * Banner "Estás offline" + atualização silenciosa: quando o service worker serve uma página
 * da cache e depois recebe uma versão mais recente, pede ao router para refrescar.
 */
export function OfflineBanner() {
  const online = useOnline();
  const router = useRouter();

  // Regista o service worker (só existe no build de produção). Protegido: alguns browsers/políticas
  // não deixam usar service workers e a app tem de funcionar na mesma.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    const w = window as Window & { __plStale?: number };
    let last = 0;
    const onStale = () => {
      w.__plStale = 0;
      const now = Date.now();
      if (now - last < 3000) return;
      last = now;
      router.refresh();
    };
    if (w.__plStale) onStale();
    window.addEventListener("pl-stale", onStale);
    return () => window.removeEventListener("pl-stale", onStale);
  }, [router]);

  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-ink px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 text-center text-sm font-medium text-gold-soft"
    >
      Estás offline — modo leitura. As alterações ficam desativadas até voltares a ter rede.
    </div>
  );
}
