import { describe, expect, it } from "vitest";
import { createPlayer, DuplicateKeyError, nameKey, validateName, type PlayerStore, type PlayerSummary } from "@/lib/players";

/** Loja em memória com a mesma restrição de unicidade da base de dados (nameKey @unique). */
function memoryStore(initial: string[] = []): PlayerStore & { rows: (PlayerSummary & { nameKey: string })[] } {
  const rows = initial.map((name, i) => ({ id: `p${i}`, name, nameKey: nameKey(name), avatarColor: "red", active: true }));
  return {
    rows,
    async findByKey(key) {
      return rows.find((r) => r.nameKey === key) ?? null;
    },
    async count() {
      return rows.length;
    },
    async create(data) {
      if (rows.some((r) => r.nameKey === data.nameKey)) throw new DuplicateKeyError();
      const row = { id: `p${rows.length}`, name: data.name, nameKey: data.nameKey, avatarColor: data.avatarColor, active: true };
      rows.push(row);
      return row;
    },
  };
}

describe("nomes de jogadores", () => {
  it("não cria 'rui' quando já existe 'Rui' e oferece o existente", async () => {
    const store = memoryStore(["Rui"]);
    const r = await createPlayer(store, "rui", null);
    expect(r.ok).toBe(false);
    if (!r.ok && r.code === "duplicate") {
      expect(r.error).toBe("Já existe um Rui");
      expect(r.existing.name).toBe("Rui");
    } else throw new Error("esperava duplicado");
    expect(store.rows).toHaveLength(1);
  });

  it("ignora espaços nas pontas e maiúsculas", async () => {
    const store = memoryStore(["Ana Sofia"]);
    const r = await createPlayer(store, "  ANA SOFIA ", "p0");
    expect(r.ok).toBe(false);
    expect(store.rows).toHaveLength(1);
  });

  it("trata a corrida entre dois pedidos simultâneos como duplicado", async () => {
    const store = memoryStore([]);
    const [a, b] = await Promise.all([createPlayer(store, "Joana", null), createPlayer(store, "joana", null)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(store.rows).toHaveLength(1);
  });

  it("cria um nome novo, guardado sem espaços nas pontas, com cor automática", async () => {
    const store = memoryStore(["Rui"]);
    const r = await createPlayer(store, "  Marta ", "p0");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.player.name).toBe("Marta");
      expect(r.player.avatarColor).toBeTruthy();
    }
  });

  it("nome obrigatório, entre 2 e 30 caracteres", () => {
    expect(validateName("")).toHaveProperty("error");
    expect(validateName("   ")).toHaveProperty("error");
    expect(validateName("A")).toHaveProperty("error");
    expect(validateName("x".repeat(31))).toHaveProperty("error");
    expect(validateName(undefined)).toHaveProperty("error");
    expect(validateName("Zé")).toEqual({ name: "Zé", key: "zé" });
    expect(validateName("x".repeat(30))).not.toHaveProperty("error");
  });
});
