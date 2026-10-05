"use client";

import { createContext, useContext, useState } from "react";
import { discardDraft, reconcileField, type FieldWarning } from "@/lib/live/field";

/** Nome de quem fez a última alteração vinda de outra pessoa (preenchido por LiveSession). */
export const LiveActorContext = createContext<string | null>(null);

/**
 * Campo controlado que segue o valor do servidor até a pessoa o começar a editar (foco ou escrita).
 * A partir daí o rascunho nunca é sobrescrito; se o servidor mudar, aparece um aviso (lib/live/field.ts).
 */
export function useLiveField(serverValue: string) {
  const changedBy = useContext(LiveActorContext);
  const [st, setSt] = useState({ draft: serverValue, typed: false, focused: false, base: serverValue });
  const r = reconcileField({ draft: st.draft, dirty: st.typed || st.focused, serverValue, baseServerValue: st.base, changedBy });

  return {
    value: r.value,
    warning: r.warning as FieldWarning | null,
    inputProps: {
      value: r.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const draft = e.target.value;
        setSt((s) => ({ ...s, draft, typed: true }));
      },
      onFocus: () => setSt((s) => (s.typed ? { ...s, focused: true } : { draft: serverValue, typed: false, focused: true, base: serverValue })),
      onBlur: () => setSt((s) => ({ ...s, focused: false, typed: s.typed && s.draft !== s.base })),
    },
    /** "Usar esse valor" */
    useServerValue: () => {
      const d = discardDraft(serverValue);
      setSt({ draft: d.value, typed: false, focused: false, base: d.baseServerValue });
    },
    /** Depois de gravar: o rascunho passa a ser o valor gravado e o campo volta a seguir o servidor. */
    saved: (value: string) => setSt({ draft: value, typed: false, focused: false, base: value }),
  };
}
