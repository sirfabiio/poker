import { redirect } from "next/navigation";

/** A chave mestra passou para "Esqueci-me do PIN" no ecrã Entrar. */
export default function MasterKeyPage() {
  redirect("/quem-es");
}
