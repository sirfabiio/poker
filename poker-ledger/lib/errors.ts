import { unstable_rethrow } from "next/navigation";

/** Erro com mensagem pensada para mostrar ao utilizador. */
export class UserError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export type Fail = { ok: false; error: string; code?: string };
export type ActionResult<T extends object = object> = ({ ok: true } & T) | Fail;

/** Corre uma ação e converte erros em resultado, para o cliente poder reverter a UI otimista. */
export async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof UserError) return { ok: false, error: e.message, code: e.code };
    console.error(e);
    return { ok: false, error: "Algo correu mal no servidor. Tenta de novo." };
  }
}
