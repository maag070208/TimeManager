/**
 * Clave interna de un rol a partir de su nombre visible:
 * "Auxiliar de almacén" → `AUXILIAR_DE_ALMACEN`. MAYÚSCULAS, dígitos y guion
 * bajo, empieza con letra, máximo 50 y sin chocar con las claves existentes.
 */
export const ROLE_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;
const MAX = 50;

export const roleKeyFromName = (name: string, taken: readonly string[] = []): string => {
  let base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) return "";
  if (!/^[A-Z]/.test(base)) base = `R_${base}`;
  base = base.slice(0, MAX).replace(/_+$/, "");
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) {
    const suffix = `_${n}`;
    key = `${base.slice(0, MAX - suffix.length)}${suffix}`;
  }
  return key;
};
