import type { ReactNode } from "react";
import { useITAppearance, ITText } from "@axzydev/axzy_ui_system";

export interface TabBarItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  /** Punto ámbar: hay cambios sin guardar en esa pestaña. */
  dot?: boolean;
}

interface Props<T extends string> {
  items: readonly TabBarItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** `sm` para pestañas internas (detalle de un rol, visor). */
  size?: "md" | "sm";
}

/**
 * Pestañas que siguen la apariencia del proveedor: en bento son píldoras (la
 * activa en tinta, con los tokens del kit que ya invierten en modo oscuro); en
 * flat/soft son pestañas con subrayado, en la línea de las tablas del sistema.
 * Se mantiene propia (no `ITTabs`) porque necesita `count`, `dot`, tamaño `sm`,
 * ids genéricos y sin panel de contenido.
 */
export default function TabBar<T extends string>({ items, value, onChange, size = "md" }: Props<T>) {
  const bento = useITAppearance() === "bento";
  const sm = size === "sm";

  if (bento) {
    return (
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-pressed={active}
              style={{
                backgroundColor: active ? "var(--it-bento-ink-bg, #0f172a)" : "var(--it-bento-control-bg, #f1f5f9)",
                color: active ? "var(--it-bento-ink-text, #ffffff)" : "var(--it-bento-control-text, #475569)",
              }}
              className={`flex shrink-0 cursor-pointer items-center rounded-full !border-0 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] ${
                sm ? "gap-1.5 px-3 py-1.5 text-[11px]" : "gap-2 px-4 py-2 text-[13px]"
              } ${active ? "shadow-[0_4px_12px_-4px_rgba(15,23,42,.35)]" : "hover:brightness-95"}`}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined && (
                <ITText as="span"
                  className="rounded-full px-1.5 text-[10px] tabular-nums"
                  style={{
                    backgroundColor: active
                      ? "color-mix(in srgb, var(--it-bento-ink-text, #ffffff) 20%, transparent)"
                      : "color-mix(in srgb, var(--it-bento-control-text, #475569) 15%, transparent)",
                  }}
                >
                  {item.count}
                </ITText>
              )}
              {item.dot && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 !bg-transparent font-bold transition ${
              size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]"
            } ${
              active
                ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <ITText as="span"
                className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[color:var(--color-primary)]"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {item.count}
              </ITText>
            )}
            {item.dot && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          </button>
        );
      })}
    </div>
  );
}
