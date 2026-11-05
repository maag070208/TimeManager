import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Anima un número de 0 al valor final (una sola vez, al montar).
 *
 * Se usa en los indicadores para que el tablero "respire" al cargar. Con
 * `prefers-reduced-motion` devuelve el valor final de inmediato.
 */
export const useCountUp = (target: number, duration = 700): number => {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const from = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const initial = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Curva de salida (ease-out cúbica): rápido al principio, aterriza suave.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(initial + (target - initial) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, reduced]);

  return value;
};

export interface AnimatedNumber {
  /** Prefijo literal del valor original (p. ej. "$"). */
  prefix: string;
  /** Sufijo literal (p. ej. " h", "%" o " d"). */
  suffix: string;
  decimals: number;
  value: number;
}

/**
 * Separa un valor ya formateado en número + prefijo/sufijo para poder animarlo.
 * Devuelve `null` cuando no es un número (texto, "—", tiempos "0:00").
 */
export const parseAnimatedNumber = (value: unknown): AnimatedNumber | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { prefix: "", suffix: "", decimals: 0, value } : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.includes(":")) return null;
  const match = text.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  const value_ = Number(digits);
  if (!Number.isFinite(value_)) return null;
  return { prefix, suffix, decimals: digits.split(".")[1]?.length ?? 0, value: value_ };
};
