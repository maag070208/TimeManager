/**
 * Compute a fixed-position placement for a floating popover anchored to a trigger.
 * Returns top/left in viewport coordinates.
 */
export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PopoverPlacement {
  top: number;
  left: number;
  placement: "below" | "above";
}

/**
 * Calcula posición fija para un popover anclado a `trigger`. Si no cabe abajo
 * (alto del popover excede el espacio restante del viewport), lo coloca arriba.
 * @param trigger BoundingClientRect-like del elemento disparador.
 * @param popoverHeight Altura estimada del popover.
 */
export const computePopoverPlacement = (
  trigger: AnchorRect,
  popoverHeight: number,
  margin = 4
): PopoverPlacement => {
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const belowTop = trigger.bottom + margin;
  const fitsBelow = belowTop + popoverHeight <= vh;
  const top = fitsBelow ? belowTop : trigger.top - popoverHeight - margin;
  return {
    top: Math.max(margin, top),
    left: trigger.left,
    placement: fitsBelow ? "below" : "above",
  };
};

import { useEffect, useState } from "react";

export interface UsePopoverPositionOptions {
  /** Ref al trigger para medir su rect. */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Altura estimada del popover (px). */
  popoverHeight?: number;
  /** Margen entre trigger y popover. */
  margin?: number;
  /** Habilita la medición; permite abrir/cerrar. */
  open: boolean;
}

export const usePopoverPosition = ({
  triggerRef,
  popoverHeight = 300,
  margin = 4,
  open,
}: UsePopoverPositionOptions): PopoverPlacement | null => {
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);

  useEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const el = triggerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setPlacement(
        computePopoverPlacement(
          {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          },
          popoverHeight,
          margin
        )
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, popoverHeight, margin, triggerRef]);

  return placement;
};
