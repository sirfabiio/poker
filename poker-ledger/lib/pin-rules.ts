// Limites do PIN partilhados com o browser (lib/pin.ts usa node:crypto e só corre no servidor).
export const PIN_MIN = 4;
export const PIN_MAX = 8;
