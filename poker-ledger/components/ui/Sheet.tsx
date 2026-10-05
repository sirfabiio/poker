"use client";

import { createContext, useCallback, useContext, useId, useRef, type ReactNode } from "react";
import { buttonClass } from "./Button";

const SheetCtx = createContext<{ close: () => void }>({ close: () => {} });
/** Permite a um formulário dentro da folha fechá-la depois de guardar. */
export const useSheet = () => useContext(SheetCtx);

/** Bottom sheet com <dialog> nativo: foco preso, Esc fecha, scrim e transição só com transform/opacity. */
export function Sheet({
  label,
  title,
  children,
  variant = "secondary",
  size = "md",
  triggerClassName = "",
  disabled,
  onOpenChange,
}: {
  label: ReactNode;
  title: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  triggerClassName?: string;
  disabled?: boolean;
  /** avisa quando abre e fecha (ex.: manter a folha montada enquanto está aberta) */
  onOpenChange?: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const close = useCallback(() => ref.current?.close(), []);

  return (
    <SheetCtx.Provider value={{ close }}>
      <button
        type="button"
        disabled={disabled}
        className={buttonClass(variant, size, triggerClassName)}
        onClick={() => {
          ref.current?.showModal();
          onOpenChange?.(true);
        }}
      >
        {label}
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-labelledby={id}
        onClose={() => onOpenChange?.(false)}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
      >
        <div className="max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/30" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={id} className="font-display text-[22px] font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="grid size-10 place-items-center rounded-full text-2xl text-ivory/80"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </SheetCtx.Provider>
  );
}
