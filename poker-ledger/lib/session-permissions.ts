// Regras partilhadas entre servidor e UI: quem pode alterar uma sessão em aberto.
// Lacre: depois de lacrada, só o admin do grupo altera a sessão (nem quem a criou).
type Role = "ADMIN" | "MEMBER";

/** Jogadores, data/notas e ajustes de contagem: qualquer membro, exceto com a sessão lacrada (aí só o admin). */
export function canEditSession(args: { role: Role; sealed: boolean }): boolean {
  return args.role === "ADMIN" || !args.sealed;
}

/** Rebuys e cash-outs: admin, ou quem criou a sessão enquanto não estiver lacrada. */
export function canEditSessionMoney(args: { role: Role; viewerId: string; createdByPlayerId: string; sealed?: boolean }): boolean {
  return args.role === "ADMIN" || (!args.sealed && args.viewerId === args.createdByPlayerId);
}

/** Lacrar: quem pode registar rebuys e cash-outs (admin ou quem criou a sessão). */
export const canSealSession = canEditSessionMoney;

/** Tirar o lacre: só o admin. */
export function canUnsealSession(args: { role: Role }): boolean {
  return args.role === "ADMIN";
}
