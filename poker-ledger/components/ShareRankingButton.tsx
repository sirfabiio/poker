"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

/** Copia o ranking em texto simples (formatado para WhatsApp) para a área de transferência. */
export function ShareRankingButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      <span aria-live="polite">{done ? "Copiado ✓" : "Partilhar ranking"}</span>
    </button>
  );
}
