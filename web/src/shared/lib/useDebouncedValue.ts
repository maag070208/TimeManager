import { useEffect, useState } from "react";

/**
 * Devuelve el valor pero "estabilizado": solo cambia después de `delay` ms sin
 * cambios. Sirve para inputs de texto que alimentan previews pesados (PDF).
 */
export const useDebouncedValue = <T,>(value: T, delay = 500): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};