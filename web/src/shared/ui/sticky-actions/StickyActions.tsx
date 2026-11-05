import type { ReactNode } from "react";

interface Props {
  /** Botones píldora (Cancelar, Guardar…); se alinean a la derecha. */
  children: ReactNode;
  className?: string;
}

/**
 * Barra de acciones fija al pie del contenido de la página (plantilla P4).
 * Fondo con el color de tarjeta del kit y sombra tenue hacia arriba; respeta el
 * área segura del móvil y deja los botones en una fila que envuelve.
 */
export default function StickyActions({ children, className = "" }: Props) {
  return (
    <div
      className={`sticky bottom-0 z-20 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-2 rounded-t-[20px] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur ${className}`}
      style={{
        background: "color-mix(in srgb, var(--it-card-bg, #ffffff) 92%, transparent)",
        boxShadow: "0 -10px 24px -14px color-mix(in srgb, var(--color-text-default, #0f172a) 28%, transparent)",
      }}
    >
      {children}
    </div>
  );
}
