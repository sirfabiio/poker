// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LivePlayer } from "@/components/session/SessionLive";

const ok = async () => ({ ok: true as const });
vi.mock("@/lib/actions/sessions", () => ({
  addBuyIn: vi.fn(ok),
  removeBuyIn: vi.fn(ok),
  removeSessionPlayer: vi.fn(ok),
  setCashOut: vi.fn(ok),
  undoReconcile: vi.fn(ok),
  reconcileSession: vi.fn(ok),
}));

const { SessionLive } = await import("@/components/session/SessionLive");
const { LiveActorContext } = await import("@/components/session/live-field");

const player = (id: string, name: string, cashOut: number | null = null): LivePlayer => ({
  id,
  playerId: `p-${id}`,
  name,
  avatarColor: "#B3202A",
  cashOut,
  adjustment: 0,
  buyIns: [{ id: `b-${id}`, amount: 2000 }],
});

function view(players: LivePlayer[], actor: string | null = "Rui") {
  return (
    <LiveActorContext.Provider value={actor}>
      <SessionLive sessionId="s1" players={players} reconciliation={null} defaultBuyIn={2000} editable isAdmin={false} />
    </LiveActorContext.Provider>
  );
}

const cashInput = (name: string) => screen.getByLabelText(new RegExp(`^Cash-out de ${name}`)) as HTMLInputElement;

afterEach(cleanup);

describe("página da sessão: atualização vinda de outra pessoa", () => {
  it("mantém o que se está a escrever no cash-out, não perde o foco e mostra o aviso", () => {
    const base = [player("a", "Ana"), player("b", "Bea"), player("c", "Cai")];
    const { rerender } = render(view(base));
    const input = cashInput("Bea");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "4" } });
    input.setSelectionRange(1, 1);

    // A meio: o Rui grava 35 € no cash-out da Bea noutro telemóvel e a página refresca.
    rerender(view([base[0], player("b", "Bea", 3500), base[2]]));
    expect(cashInput("Bea")).toBe(input); // mesmo elemento (não remontou)
    expect(input.value).toBe("4");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(screen.getByText("Valor alterado por Rui: 35,00 €")).toBeTruthy();

    // continua a escrever sem perder nada
    fireEvent.change(input, { target: { value: "40" } });
    expect(input.value).toBe("40");

    // "Usar esse valor" descarta o rascunho
    fireEvent.click(screen.getByRole("button", { name: "Usar esse valor" }));
    expect(input.value).toBe("35,00");
    expect(screen.queryByText(/Valor alterado por/)).toBeNull();
  });

  it("sem edição, o campo segue o valor novo do servidor", () => {
    const { rerender } = render(view([player("a", "Ana"), player("b", "Bea")]));
    rerender(view([player("a", "Ana", 1500), player("b", "Bea")]));
    expect(cashInput("Ana").value).toBe("15,00");
    expect(screen.queryByText(/Valor alterado por/)).toBeNull();
  });

  it("remover outro jogador não remonta as outras linhas (key = SessionPlayer.id)", () => {
    const base = [player("a", "Ana"), player("b", "Bea"), player("c", "Cai")];
    const { rerender } = render(view(base));
    const cai = cashInput("Cai");
    const bea = cashInput("Bea");
    act(() => cai.focus());
    fireEvent.change(cai, { target: { value: "12" } });
    rerender(view([base[1], base[2]])); // outra pessoa tirou a Ana
    expect(cashInput("Cai")).toBe(cai);
    expect(cashInput("Bea")).toBe(bea);
    expect(cai.value).toBe("12");
    expect(document.activeElement).toBe(cai);
  });

  it("se outra pessoa tirar o jogador que eu estava a editar, aparece uma mensagem", () => {
    const base = [player("a", "Ana"), player("b", "Bea")];
    const { rerender } = render(view(base));
    const bea = cashInput("Bea");
    act(() => bea.focus());
    fireEvent.change(bea, { target: { value: "9" } });
    rerender(view([base[0]]));
    expect(screen.getByText(/Outra pessoa tirou Bea da sessão/)).toBeTruthy();
  });
});
