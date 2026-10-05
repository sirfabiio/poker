// Regras para um campo que pode mudar no servidor enquanto alguém o está a escrever (cash-out, rebuy personalizado).
// Valores em texto, tal como aparecem no input ("" = vazio).

export type FieldWarning = { changedBy: string | null; serverValue: string };

export type FieldInput = {
  /** o que está escrito no campo */
  draft: string;
  /** a pessoa está a editar (escreveu ou tem o campo focado) */
  dirty: boolean;
  /** valor atual no servidor */
  serverValue: string;
  /** valor do servidor quando a edição começou */
  baseServerValue: string;
  changedBy?: string | null;
};

export type FieldOutput = { value: string; dirty: boolean; baseServerValue: string; warning: FieldWarning | null };

/**
 * Sem edição: segue o servidor. Com edição: mantém sempre o rascunho; se o servidor mudou desde que a edição
 * começou, devolve um aviso para a pessoa decidir ("Usar esse valor" = discardDraft).
 */
export function reconcileField({ draft, dirty, serverValue, baseServerValue, changedBy = null }: FieldInput): FieldOutput {
  if (!dirty) return { value: serverValue, dirty: false, baseServerValue: serverValue, warning: null };
  if (serverValue !== baseServerValue && serverValue !== draft) {
    return { value: draft, dirty: true, baseServerValue, warning: { changedBy, serverValue } };
  }
  return { value: draft, dirty: true, baseServerValue, warning: null };
}

/** "Usar esse valor": descarta o rascunho e passa a seguir o servidor. */
export function discardDraft(serverValue: string): FieldOutput {
  return { value: serverValue, dirty: false, baseServerValue: serverValue, warning: null };
}
