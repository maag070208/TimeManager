import { useCallback, useRef } from "react";

// FNV-1a de 32 bits: huella corta y estable del contenido de la petición.
const fingerprint = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

// `getRandomValues` funciona también fuera de contextos seguros (http en la red local).
const randomBase = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Clave de idempotencia (`Idempotency-Key`) para las altas de un formulario:
 * base aleatoria por montaje + huella del contenido. El mismo envío repetido
 * (doble clic, reintento tras un corte) lleva la misma clave y la API no lo
 * duplica; si el contenido cambia, es una petición nueva.
 */
export const useRequestKey = () => {
  const base = useRef<string | null>(null);
  return useCallback((payload: unknown): string => {
    base.current ??= randomBase();
    return `${base.current}-${fingerprint(JSON.stringify(payload))}`;
  }, []);
};
