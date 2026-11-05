/**
 * Identificador único para llaves de React (renglones de un formulario, filas
 * dinámicas).
 *
 * `crypto.randomUUID` SOLO existe en **contexto seguro**: https o localhost. El
 * cliente entra por `http://IP:8080`, así que ahí la función no existe y la
 * pantalla que la usaba se caía al cargar con
 * `TypeError: crypto.randomUUID is not a function` (nos pasó en Nuevo
 * movimiento, que se quedaba en blanco).
 *
 * `crypto.getRandomValues` sí está disponible fuera de contexto seguro (es lo
 * que ya usa `useRequestKey` para las claves de idempotencia), así que el id se
 * arma con eso; el `Math.random` final es solo por si no hubiera `crypto`.
 */
export const newId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
