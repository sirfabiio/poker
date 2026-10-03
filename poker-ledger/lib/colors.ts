export const AVATAR_COLORS = ["red", "blue", "gold", "green", "ink", "ivory"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_COLOR_LABELS: Record<AvatarColor, string> = {
  red: "Vermelho",
  blue: "Azul",
  gold: "Dourado",
  green: "Verde",
  ink: "Preto",
  ivory: "Marfim",
};

export function isAvatarColor(v: unknown): v is AvatarColor {
  return typeof v === "string" && (AVATAR_COLORS as readonly string[]).includes(v);
}

/** Cor automática: roda pela paleta conforme o número de jogadores existentes. */
export function autoAvatarColor(existingCount: number): AvatarColor {
  return AVATAR_COLORS[existingCount % AVATAR_COLORS.length];
}
