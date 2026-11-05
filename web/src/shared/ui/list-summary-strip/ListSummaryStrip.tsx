import type { ReactNode } from "react";
import { ITBentoTile } from "@axzydev/axzy_ui_system";

type Tone = "plain" | "sea" | "lavender" | "mint" | "sun";

export interface ListSummaryItem {
  id: string;
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  caption?: ReactNode;
}

interface Props {
  /** 2 a 4 totales reales de la lista. */
  items: readonly ListSummaryItem[];
  /** Mosaico seleccionado (filtro activo). */
  activeId?: string;
  /** Con esto los mosaicos funcionan como filtro rápido; sin esto son informativos. */
  onSelect?: (id: string) => void;
  className?: string;
}

const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/**
 * Franja de resumen de una lista (plantilla P2): `ITBentoTile`s con totales
 * reales que filtran al hacer clic. El mosaico activo lleva un contorno del
 * color primario; el clic lo recibe un botón transparente encima (con
 * `aria-pressed` y foco de teclado), porque el mosaico del kit no expone ARIA.
 */
export default function ListSummaryStrip({ items, activeId, onSelect, className = "" }: Props) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${COLS[Math.min(Math.max(items.length, 1), 4)]} ${className}`}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <div
            key={item.id}
            className={`relative flex min-w-0 ${onSelect ? "transition-transform hover:-translate-y-0.5" : ""}`}
          >
            <ITBentoTile
              label={item.label}
              icon={item.icon}
              tone={item.tone}
              value={item.value}
              caption={item.caption}
              className="min-h-[96px] flex-1 justify-between"
              style={active ? { boxShadow: "inset 0 0 0 2px var(--color-primary)" } : undefined}
            />
            {onSelect && (
              <button
                type="button"
                aria-pressed={active}
                aria-label={item.label}
                onClick={() => onSelect(item.id)}
                className="absolute inset-0 cursor-pointer rounded-[20px] !border-0 !bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
