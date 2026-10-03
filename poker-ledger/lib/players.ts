// Regras de criação de jogadores. Sem dependência do Prisma para poder ser testado isoladamente.
import { autoAvatarColor } from "./colors";

export const NAME_MIN = 2;
export const NAME_MAX = 30;

/** Nome único ignorando maiúsculas/minúsculas e espaços nas pontas. */
export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase("pt-PT");
}

export function validateName(raw: unknown): { name: string; key: string } | { error: string } {
  if (typeof raw !== "string") return { error: "O nome é obrigatório." };
  const name = raw.trim();
  if (!name) return { error: "O nome é obrigatório." };
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { error: `O nome tem de ter entre ${NAME_MIN} e ${NAME_MAX} caracteres.` };
  }
  return { name, key: nameKey(name) };
}

export type PlayerSummary = { id: string; name: string; avatarColor: string; active: boolean };

/** Acesso mínimo aos dados de que a criação precisa (implementado com Prisma em players-db.ts). */
export interface PlayerStore {
  findByKey(key: string): Promise<PlayerSummary | null>;
  count(): Promise<number>;
  /** Deve lançar DuplicateKeyError se a chave única já existir (corrida entre pedidos). */
  create(data: {
    name: string;
    nameKey: string;
    avatarColor: string;
    createdByPlayerId: string | null;
  }): Promise<PlayerSummary>;
}

export class DuplicateKeyError extends Error {}

export type CreatePlayerResult =
  | { ok: true; player: PlayerSummary }
  | { ok: false; code: "invalid"; error: string }
  | { ok: false; code: "duplicate"; error: string; existing: PlayerSummary };

export function duplicateMessage(existing: { name: string }) {
  return `Já existe um ${existing.name}`;
}

/** Cria um jogador, ou devolve o existente se o nome já estiver usado. */
export async function createPlayer(
  store: PlayerStore,
  rawName: unknown,
  createdByPlayerId: string | null,
): Promise<CreatePlayerResult> {
  const v = validateName(rawName);
  if ("error" in v) return { ok: false, code: "invalid", error: v.error };

  const dup = async (): Promise<CreatePlayerResult | null> => {
    const existing = await store.findByKey(v.key);
    return existing ? { ok: false, code: "duplicate", error: duplicateMessage(existing), existing } : null;
  };

  const before = await dup();
  if (before) return before;

  try {
    const player = await store.create({
      name: v.name,
      nameKey: v.key,
      avatarColor: autoAvatarColor(await store.count()),
      createdByPlayerId,
    });
    return { ok: true, player };
  } catch (e) {
    if (e instanceof DuplicateKeyError) {
      const after = await dup();
      if (after) return after;
    }
    throw e;
  }
}
