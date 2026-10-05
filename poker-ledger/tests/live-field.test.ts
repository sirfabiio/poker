import { describe, expect, it } from "vitest";
import { discardDraft, reconcileField } from "@/lib/live/field";

describe("reconcileField", () => {
  it("sem rascunho segue o servidor", () => {
    expect(reconcileField({ draft: "30,00", dirty: false, serverValue: "35,00", baseServerValue: "30,00" })).toEqual({
      value: "35,00",
      dirty: false,
      baseServerValue: "35,00",
      warning: null,
    });
  });

  it("com rascunho e servidor alterado: mantém o rascunho e avisa", () => {
    const r = reconcileField({ draft: "40", dirty: true, serverValue: "35,00", baseServerValue: "30,00", changedBy: "Rui" });
    expect(r.value).toBe("40");
    expect(r.dirty).toBe(true);
    expect(r.baseServerValue).toBe("30,00");
    expect(r.warning).toEqual({ changedBy: "Rui", serverValue: "35,00" });
  });

  it("com rascunho e servidor igual: mantém o rascunho sem aviso", () => {
    const r = reconcileField({ draft: "40", dirty: true, serverValue: "30,00", baseServerValue: "30,00" });
    expect(r).toEqual({ value: "40", dirty: true, baseServerValue: "30,00", warning: null });
  });

  it("servidor mudou para o mesmo valor do rascunho: sem aviso", () => {
    expect(reconcileField({ draft: "35,00", dirty: true, serverValue: "35,00", baseServerValue: "30,00" }).warning).toBeNull();
  });

  it('"Usar esse valor" descarta o rascunho e volta a seguir o servidor', () => {
    const d = discardDraft("35,00");
    expect(d).toEqual({ value: "35,00", dirty: false, baseServerValue: "35,00", warning: null });
    const next = reconcileField({ draft: d.value, dirty: d.dirty, serverValue: "50,00", baseServerValue: d.baseServerValue });
    expect(next.value).toBe("50,00");
  });
});
