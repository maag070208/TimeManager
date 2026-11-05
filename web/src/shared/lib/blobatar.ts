import { blobatar } from "blobatar";

/**
 * Blobatar determinista de un nombre como `data:` URI.
 *
 * `ProfileAvatar` monta el componente de React, pero hay lugares donde el
 * contrato solo acepta una URL de imagen (p. ej. `userImage` de `ITTopBar`):
 * ahí se usa esto, que es la misma figura para el mismo nombre.
 */
const cache = new Map<string, string>();

export const blobatarDataUri = (name: string): string => {
  const seed = name.trim() || "Puerto Nuevo";
  const hit = cache.get(seed);
  if (hit) return hit;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(blobatar(seed, { size: 96 }))}`;
  cache.set(seed, uri);
  return uri;
};
