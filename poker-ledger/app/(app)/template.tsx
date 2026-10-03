/** Transição de página: fade curto (só opacity), refeito a cada navegação. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
