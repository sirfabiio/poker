import { redirect } from "next/navigation";

/** A gestão de membros passou para as definições do grupo. */
export default function AdminPage() {
  redirect("/grupo");
}
