// Limites "suaves" da reconciliação: acima de qualquer um, confirmar o ajuste exige o PIN de admin.
export const RECONCILE_SOFT_LIMIT_CENTS = 500;
export const RECONCILE_SOFT_LIMIT_PERCENT = 5;

// Estatísticas: médias, %, ROI e desvio-padrão só com pelo menos este número de sessões.
export const MIN_SESSIONS_FOR_RATES = 3;

/** Tag da cache das estatísticas (invalidada em escritas a sessões, entradas, cash-outs, ajustes e perfis). */
export const STATS_TAG = "stats";
/** Rede de segurança da cache das estatísticas para alterações feitas fora da app (segundos). */
export const STATS_MAX_AGE_SECONDS = 600;
