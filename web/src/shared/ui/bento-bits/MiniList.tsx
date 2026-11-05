import type { ReactNode } from "react";
import { LuCheck } from "react-icons/lu";
import { ITText } from "@axzydev/axzy_ui_system";

interface Props {
  icon: ReactNode;
  title: string;
  items: { id: string; name: string; right: string }[];
  emptyLabel: string;
  /** Abre la pantalla donde se atiende el pendiente. */
  onClick?: () => void;
}

/** Fila de una lista corta dentro de una tarjeta bento, con su estado "sin pendientes". */
export default function MiniList({ icon, title, items, emptyLabel, onClick }: Props) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex flex-1 flex-col justify-center rounded-[14px] px-2.5 py-1.5 ${
        onClick ? "cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,currentColor_9%,transparent)]" : ""
      }`}
      style={{ background: "color-mix(in srgb, currentColor 5%, transparent)" }}
    >
      <ITText className="m-0 flex items-center gap-2 text-[12px] font-semibold leading-tight">
        <ITText as="span" className="flex h-5 w-5 items-center justify-center rounded-[8px]" style={{ background: "color-mix(in srgb, currentColor 9%, transparent)" }}>
          {icon}
        </ITText>
        {title}
      </ITText>
      {items.length === 0 ? (
        <ITText className="m-0 mt-px flex items-center gap-1 pl-7 text-[11px] leading-none" style={{ color: "var(--it-bento-muted)" }}>
          {emptyLabel}
          <LuCheck size={12} className="text-[color:var(--color-success)]" />
        </ITText>
      ) : (
        <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 overflow-y-auto p-0" style={{ maxHeight: 92 }}>
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-[12px]">
              <ITText as="span" className="truncate">{item.name}</ITText>
              <ITText as="span" className="shrink-0 text-[11px]" style={{ color: "var(--it-bento-muted)" }}>
                {item.right}
              </ITText>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
