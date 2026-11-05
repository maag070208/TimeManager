import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * `true` si el sistema pide menos movimiento. Las animaciones decorativas del
 * tablero (entradas, arcos, olas) se apagan con esto; nunca son la única forma
 * de leer un dato.
 */
export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(QUERY);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
};
