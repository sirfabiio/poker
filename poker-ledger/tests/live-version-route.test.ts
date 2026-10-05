import { beforeEach, describe, expect, it, vi } from "vitest";

const cookie = { value: undefined as string | undefined };
const findUnique = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "pl_player" && cookie.value ? { name: n, value: cookie.value } : undefined) }),
}));
vi.mock("@/lib/db", () => ({ db: { session: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const { GET } = await import("@/app/api/sessions/[id]/version/route");
const call = (id: string) => GET(new Request(`http://x/api/sessions/${id}/version`), { params: Promise.resolve({ id }) });

describe("GET /api/sessions/[id]/version", () => {
  beforeEach(() => {
    cookie.value = undefined;
    findUnique.mockReset();
  });

  it("401 sem perfil escolhido (e não toca na BD)", async () => {
    const r = await call("s1");
    expect(r.status).toBe(401);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("404 para sessão inexistente", async () => {
    cookie.value = "p1";
    findUnique.mockResolvedValue(null);
    const r = await call("nao-existe");
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uma leitura por id, só versão/autor/tipo/fechada: sem valores nem nomes; no-store", async () => {
    cookie.value = "p1";
    findUnique.mockResolvedValue({ version: 7, lastActorPlayerId: "rui", lastChangeType: "rebuy_added", settlementId: "st1" });
    const r = await call("s1");
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ version: 7, lastActorPlayerId: "rui", lastChangeType: "rebuy_added", settled: true });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "s1" },
      select: { version: true, lastActorPlayerId: true, lastChangeType: true, settlementId: true },
    });
  });
});
