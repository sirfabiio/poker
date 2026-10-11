import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashToken } from "@/lib/pin";

const cookie = { value: undefined as string | undefined };
const findUnique = vi.fn();
const VALID = "token-valido";
const player = { id: "p1", name: "Rui", avatarColor: "red", ibanOrMbway: null, active: true };
const authFind = vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
  where.tokenHash === hashToken(VALID) ? { expiresAt: new Date(Date.now() + 60_000), player } : null,
);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "pl_session" && cookie.value ? { name: n, value: cookie.value } : undefined) }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    session: { findUnique: (...a: unknown[]) => findUnique(...a) },
    authSession: { findUnique: (a: { where: { tokenHash: string } }) => authFind(a) },
  },
}));

const { GET } = await import("@/app/api/sessions/[id]/version/route");
const call = (id: string) => GET(new Request(`http://x/api/sessions/${id}/version`), { params: Promise.resolve({ id }) });

describe("GET /api/sessions/[id]/version", () => {
  beforeEach(() => {
    cookie.value = undefined;
    findUnique.mockReset();
  });

  it("401 sem sessão iniciada (e não lê a sessão de jogo)", async () => {
    const r = await call("s1");
    expect(r.status).toBe(401);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("401 com um cookie que não corresponde a nenhuma sessão de login (ex.: o antigo id do jogador)", async () => {
    cookie.value = "p1";
    const r = await call("s1");
    expect(r.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("401 com sessão de login expirada", async () => {
    cookie.value = VALID;
    authFind.mockResolvedValueOnce({ expiresAt: new Date(Date.now() - 1000), player });
    const r = await call("s1");
    expect(r.status).toBe(401);
  });

  it("404 para sessão inexistente", async () => {
    cookie.value = VALID;
    findUnique.mockResolvedValue(null);
    const r = await call("nao-existe");
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uma leitura por id, só versão/autor/tipo/fechada: sem valores nem nomes; no-store", async () => {
    cookie.value = VALID;
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
