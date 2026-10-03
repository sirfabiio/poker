"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "pl-install-dismissed";

/** Banner discreto "Instalar app" (Android/Chrome) e instruções curtas para iOS Safari. */
export function InstallBanner() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) setIos(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!evt && !ios) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setEvt(null);
    setIos(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-30 px-4">
      <div className="glass mx-auto flex max-w-md items-center gap-3 rounded-full py-2 pr-2 pl-4 text-sm">
        <p className="flex-1">
          {evt ? "Instala a app para abrir mais rápido." : "Para instalar: toca em Partilhar e depois em “Adicionar ao ecrã principal”."}
        </p>
        {evt && (
          <button
            type="button"
            className="min-h-9 rounded-full bg-gold px-3.5 font-semibold text-ink"
            onClick={async () => {
              await evt.prompt();
              await evt.userChoice.catch(() => null);
              close();
            }}
          >
            Instalar app
          </button>
        )}
        <button type="button" aria-label="Fechar aviso de instalação" onClick={close} className="grid size-9 place-items-center rounded-full text-lg text-ivory/80">
          ×
        </button>
      </div>
    </div>
  );
}
