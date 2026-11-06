// Regra partilhada entre servidor e UI: quem pode registar rebuys e cash-outs numa sessão.
export function canEditSessionMoney(args: { role: "ADMIN" | "MEMBER"; viewerId: string; createdByPlayerId: string }): boolean {
  return args.role === "ADMIN" || args.viewerId === args.createdByPlayerId;
}
